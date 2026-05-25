import {
  Canvas,
  useCanvasRef,
  type CanvasRef,
} from 'react-native-wgpu';
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DataTexture,
  EquirectangularReflectionMapping,
  HalfFloatType,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  Vector3,
  type Material,
} from 'three';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { makeWebGPURenderer, useBusyJS } from '../utils';
import { scheduleOnUI } from 'react-native-worklets';
import { useEffect, useState } from 'react';
import { useGLTF, useRGBE, type GLTF } from './AssetManager';

type SerializedMesh = {
  positions: Float32Array;
  normals: Float32Array | null;
  uvs: Float32Array | null;
  indices: Uint16Array | Uint32Array | null;
  matrix: Float32Array;
  color: [number, number, number];
  metalness: number;
  roughness: number;
};

type SerializedEnv = {
  data: Uint16Array;
  width: number;
  height: number;
};

export default function GPUExample() {
  const ref = useCanvasRef();
  const toggleBusyJS = useBusyJS();
  const gltf = useGLTF(require('./assets/helmet/DamagedHelmet.gltf'));
  const env = useRGBE(require('./assets/helmet/royal_esplanade_1k.hdr'));

  useEffect(() => {
    if (!gltf || !env) {
      return;
    }
    const meshes = serializeScene(gltf);
    const envData = serializeEnv(env);
    renderOnUI(ref, meshes, envData);
    return cleanupOnUI();
  }, [gltf, env, ref]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StateAnimatedBox />
        <Pressable style={styles.button} onPress={toggleBusyJS}>
          <Text style={styles.buttonText}>Toggle busy JS</Text>
        </Pressable>
      </View>
      <Canvas ref={ref} style={styles.gpu} />
    </View>
  );
}

function serializeScene(gltf: GLTF): SerializedMesh[] {
  gltf.scene.updateMatrixWorld(true);
  const meshes: SerializedMesh[] = [];
  gltf.scene.traverse(obj => {
    const mesh = obj as Mesh;
    if (!(mesh as any).isMesh) {
      return;
    }
    const geo = mesh.geometry as BufferGeometry;
    const mat = mesh.material as Material & {
      color?: Color;
      metalness?: number;
      roughness?: number;
    };
    const position = geo.attributes.position as BufferAttribute;
    const normal = geo.attributes.normal as BufferAttribute | undefined;
    const uv = geo.attributes.uv as BufferAttribute | undefined;
    const index = geo.index;
    const color = mat.color ?? new Color(0xcccccc);
    meshes.push({
      positions: new Float32Array(position.array),
      normals: normal ? new Float32Array(normal.array) : null,
      uvs: uv ? new Float32Array(uv.array) : null,
      indices: index
        ? index.array.BYTES_PER_ELEMENT === 4
          ? new Uint32Array(index.array as Uint32Array)
          : new Uint16Array(index.array as Uint16Array)
        : null,
      matrix: new Float32Array(mesh.matrixWorld.elements),
      color: [color.r, color.g, color.b],
      metalness: mat.metalness ?? 0.8,
      roughness: mat.roughness ?? 0.4,
    });
  });
  return meshes;
}

function serializeEnv(texture: { image: any }): SerializedEnv {
  const image = texture.image;
  return {
    data: new Uint16Array(image.data.buffer ?? image.data),
    width: image.width,
    height: image.height,
  };
}

function renderOnUI(
  ref: React.RefObject<CanvasRef>,
  meshes: SerializedMesh[],
  env: SerializedEnv,
) {
  const context = ref.current!.getContext('webgpu')!;

  const navigator = globalThis.navigator as NavigatorGPU;
  const GPUBufferUsage = globalThis.GPUBufferUsage;
  const GPUColorWrite = globalThis.GPUColorWrite;
  const GPUMapMode = globalThis.GPUMapMode;
  const GPUShaderStage = globalThis.GPUShaderStage;
  const GPUTextureUsage = globalThis.GPUTextureUsage;

  scheduleOnUI(async () => {
    'worklet';

    if (!globalThis.self) {
      globalThis.self = globalThis;
      globalThis.navigator = { gpu: navigator.gpu } as NavigatorGPU;
      globalThis.GPUBufferUsage = GPUBufferUsage;
      globalThis.GPUColorWrite = GPUColorWrite;
      globalThis.GPUMapMode = GPUMapMode;
      globalThis.GPUShaderStage = GPUShaderStage;
      globalThis.GPUTextureUsage = GPUTextureUsage;
      globalThis.setImmediate =
        globalThis.requestAnimationFrame as typeof setImmediate;
    }

    if (globalThis.renderer) {
      return;
    }

    const { width, height } = context.canvas as typeof context.canvas & {
      width: number;
      height: number;
    };

    const camera = new PerspectiveCamera(45, width / height, 0.25, 20);
    camera.position.set(-1.8, 0.6, 2.7);

    const scene = new Scene();

    const envTexture = new DataTexture(
      env.data,
      env.width,
      env.height,
      RGBAFormat,
      HalfFloatType,
    );
    envTexture.mapping = EquirectangularReflectionMapping;
    envTexture.needsUpdate = true;

    scene.background = envTexture;
    scene.environment = envTexture;

    for (const m of meshes) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(m.positions, 3),
      );
      if (m.normals) {
        geometry.setAttribute(
          'normal',
          new BufferAttribute(m.normals, 3),
        );
      }
      if (m.uvs) {
        geometry.setAttribute('uv', new BufferAttribute(m.uvs, 2));
      }
      if (m.indices) {
        geometry.setIndex(new BufferAttribute(m.indices, 1));
      }
      if (!m.normals) {
        geometry.computeVertexNormals();
      }
      const material = new MeshStandardMaterial({
        color: new Color(m.color[0], m.color[1], m.color[2]),
        metalness: m.metalness,
        roughness: m.roughness,
      });
      const mesh = new Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.fromArray(Array.from(m.matrix));
      scene.add(mesh);
    }

    const renderer = makeWebGPURenderer(context);
    renderer.toneMapping = ACESFilmicToneMapping;
    await renderer.init();

    const clock = new Clock();

    function animate() {
      const elapsed = clock.getElapsedTime();
      const distance = 3;
      camera.position.x = Math.sin(elapsed) * distance;
      camera.position.z = Math.cos(elapsed) * distance;
      camera.lookAt(new Vector3(0, 0, 0));

      renderer.render(scene, camera);
      context!.present();
    }

    globalThis.renderer = renderer;
    await renderer.setAnimationLoop(animate);
  });
}

function cleanupOnUI() {
  return () => {
    scheduleOnUI(async () => {
      'worklet';
      if (globalThis.renderer) {
        await globalThis.renderer.setAnimationLoop(null);
        globalThis.renderer = null;
      }
    });
  };
}

function StateAnimatedBox() {
  const [transform, setTransform] = useState({ rotate: 0 });

  useEffect(() => {
    let frameId: number;

    function animate() {
      setTransform(({ rotate }) => ({
        rotate: rotate + 0.04,
      }));
      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <View
      style={[
        styles.box,
        { transform: [{ rotate: `${transform.rotate}rad` }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  gpu: {
    flex: 1,
  },
  box: {
    width: 28,
    height: 28,
    backgroundColor: 'blue',
  },
});
