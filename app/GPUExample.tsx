import {
  Canvas,
  useCanvasRef,
  type CanvasRef,
} from 'react-native-webgpu';
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  NumberKeyframeTrack,
  PerspectiveCamera,
  QuaternionKeyframeTrack,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  UnsignedByteType,
  VectorKeyframeTrack,
} from 'three/webgpu';
import {
  blendOverlay,
  checker,
  color,
  grayscale,
  hue,
  oscSine,
  saturation,
  screenUV,
  texture as textureNode,
  uv,
  vec3,
  viewportSafeUV,
  viewportSharedTexture,
  viewportUV,
} from 'three/tsl';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { makeWebGPURenderer, useBusyJS } from '../utils';
import {
  createWorkletRuntime,
  scheduleOnRuntime,
  scheduleOnUI,
} from 'react-native-worklets';
import { useEffect, useState } from 'react';
import { useGLTF, useRawBytes, type GLTF } from './AssetManager';

const DIFFUSE_SIZE = 512;

// Dedicated worklet runtime: rendering runs on its own thread, independent of
// both the JS thread and the Reanimated UI thread, so a busy JS thread can't
// stall the animation. Present is NOT automatic here (it is only auto-driven on
// the JS / UI runtimes), so we call context.present() after each submit.
const GPURuntime = createWorkletRuntime('gpu');

type Thread = 'dedicated' | 'ui';

// A scheduler picks which runtime the render worklet runs on. The render worklet
// body is identical for both: context.present() is a no-op on the UI runtime
// (present is auto-driven there) and the required call on the dedicated runtime,
// so the same worklet is safe on either.
function scheduleFor(thread: Thread): (worklet: () => void) => void {
  return thread === 'dedicated'
    ? worklet => scheduleOnRuntime(GPURuntime, worklet)
    : worklet => scheduleOnUI(worklet);
}

type SerializedBone = {
  name: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  parent: number;
};

type SerializedTrack = {
  name: string;
  times: Float32Array;
  values: Float32Array;
  type: string;
  interpolation?: number;
};

type SerializedModel = {
  positions: Float32Array;
  uvs: Float32Array | null;
  skinIndices: Uint16Array;
  skinWeights: Float32Array;
  indices: Uint16Array | Uint32Array | null;
  bones: SerializedBone[];
  boneInverses: Float32Array;
  bindMatrix: Float32Array;
  meshMatrix: Float32Array;
  rootMatrix: Float32Array;
  duration: number;
  tracks: SerializedTrack[];
};

// Renders the dancing Michelle on a dedicated worklet runtime (its own thread).
// Stays smooth while the JS thread is busy.
export default function GPUExample() {
  return <Backdrop thread="dedicated" label="Dedicated thread" />;
}

// Renders the same scene on the Reanimated UI runtime. Because the FrameDriver
// auto-present is dispatched through the main JS runtime's scheduler, presents
// happen on the JS thread, so a busy JS thread stalls the animation.
export function GPUExampleUI() {
  return <Backdrop thread="ui" label="UI thread" />;
}

function Backdrop({ thread, label }: { thread: Thread; label: string }) {
  const ref = useCanvasRef();
  const toggleBusyJS = useBusyJS();
  const gltf = useGLTF(require('./assets/michelle/model.gltf'));
  const diffuse = useRawBytes(
    require('./assets/michelle/Ch03_1001_Diffuse.512.rgba8.bin'),
  );

  useEffect(() => {
    if (!gltf || !diffuse) {
      return;
    }
    const model = serializeModel(gltf);
    if (!model) {
      console.error('No skinned mesh found in gltf');
      return;
    }
    const schedule = scheduleFor(thread);
    renderScene(ref, model, diffuse, schedule);
    return cleanupScene(schedule);
  }, [gltf, diffuse, ref, thread]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <StateAnimatedBox />
          <Text style={styles.threadLabel}>{label}</Text>
        </View>
        <Pressable style={styles.button} onPress={toggleBusyJS}>
          <Text style={styles.buttonText}>Toggle busy JS</Text>
        </Pressable>
      </View>
      <Canvas ref={ref} style={styles.gpu} />
    </View>
  );
}

// Serialize a skinned, animated GLTF into plain typed arrays so it can cross
// into the worklet runtime, where three.js objects can't be passed directly.
// The skeleton hierarchy, bind matrices, skin weights and animation clip are
// all captured here on the JS thread; the worklet rebuilds a live SkinnedMesh +
// Skeleton + AnimationMixer from this data and runs the animation itself.
function serializeModel(gltf: GLTF): SerializedModel | null {
  gltf.scene.updateMatrixWorld(true);

  let skinned: SkinnedMesh | null = null;
  gltf.scene.traverse(o => {
    if ((o as any).isSkinnedMesh && !skinned) {
      skinned = o as SkinnedMesh;
    }
  });
  if (!skinned) {
    return null;
  }
  const mesh = skinned as SkinnedMesh;
  const geo = mesh.geometry as BufferGeometry;
  const skeleton = mesh.skeleton;
  const bones = skeleton.bones;

  const boneIndex = new Map<Bone, number>();
  bones.forEach((b, i) => boneIndex.set(b, i));

  const serBones: SerializedBone[] = bones.map(b => ({
    name: b.name,
    position: [b.position.x, b.position.y, b.position.z],
    quaternion: [
      b.quaternion.x,
      b.quaternion.y,
      b.quaternion.z,
      b.quaternion.w,
    ],
    scale: [b.scale.x, b.scale.y, b.scale.z],
    parent:
      b.parent && boneIndex.has(b.parent as Bone)
        ? boneIndex.get(b.parent as Bone)!
        : -1,
  }));

  // World transform that sits above the root bone(s) (Michelle's root node has
  // a 0.01 scale). The reconstructed skeleton is parented under a group with
  // this matrix so bone world matrices match the original bind setup.
  const rootBone = bones.find((_, i) => serBones[i].parent === -1)!;
  const rootParent = rootBone.parent ?? gltf.scene;
  const rootMatrix = new Float32Array(rootParent.matrixWorld.elements);

  const boneInverses = new Float32Array(bones.length * 16);
  skeleton.boneInverses.forEach((m, i) => boneInverses.set(m.elements, i * 16));

  const position = geo.attributes.position as BufferAttribute;
  const uvAttr = geo.attributes.uv as BufferAttribute | undefined;
  const skinIndex = geo.attributes.skinIndex as BufferAttribute;
  const skinWeight = geo.attributes.skinWeight as BufferAttribute;
  const index = geo.index;

  const clip = gltf.animations[0];
  const tracks: SerializedTrack[] = clip.tracks.map(t => ({
    name: t.name,
    times: new Float32Array(t.times),
    values: new Float32Array(t.values),
    type: (t as any).ValueTypeName as string,
    interpolation: (t as any).getInterpolation?.(),
  }));

  return {
    positions: new Float32Array(position.array),
    uvs: uvAttr ? new Float32Array(uvAttr.array) : null,
    skinIndices: new Uint16Array(skinIndex.array),
    skinWeights: new Float32Array(skinWeight.array),
    indices: index
      ? index.array.BYTES_PER_ELEMENT === 4
        ? new Uint32Array(index.array as Uint32Array)
        : new Uint16Array(index.array as Uint16Array)
      : null,
    bones: serBones,
    boneInverses,
    bindMatrix: new Float32Array(mesh.bindMatrix.elements),
    meshMatrix: new Float32Array(mesh.matrixWorld.elements),
    rootMatrix,
    duration: clip.duration,
    tracks,
  };
}

async function renderScene(
  ref: React.RefObject<CanvasRef>,
  model: SerializedModel,
  diffuse: Uint8Array,
  schedule: (worklet: () => void) => void,
) {
  const context = ref.current!.getContext('webgpu')!;

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();

  const nav = globalThis.navigator as NavigatorGPU;
  const GPUBufferUsage = globalThis.GPUBufferUsage;
  const GPUColorWrite = globalThis.GPUColorWrite;
  const GPUMapMode = globalThis.GPUMapMode;
  const GPUShaderStage = globalThis.GPUShaderStage;
  const GPUTextureUsage = globalThis.GPUTextureUsage;

  schedule(() => {
    'worklet';

    if (!globalThis.self) {
      globalThis.self = globalThis;
      globalThis.navigator = { gpu: nav.gpu } as NavigatorGPU;
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

    const camera = new PerspectiveCamera(50, width / height, 0.01, 100);
    camera.position.set(1, 2, 3);
    camera.lookAt(0, 1, 0);

    const scene = new Scene();
    scene.backgroundNode = screenUV.y.mix(color(0x66bbff), color(0x4466ff));

    // Diffuse map rebuilt from baked raw RGBA8 bytes. A 2D DataTexture uploads
    // via writeTexture (not the native ImageBitmap path), so it crosses the
    // worklet boundary fine. flipY=false matches the glTF UV convention.
    const diffuseTex = new DataTexture(
      diffuse,
      DIFFUSE_SIZE,
      DIFFUSE_SIZE,
      RGBAFormat,
      UnsignedByteType,
    );
    diffuseTex.colorSpace = SRGBColorSpace;
    diffuseTex.wrapS = ClampToEdgeWrapping;
    diffuseTex.wrapT = ClampToEdgeWrapping;
    diffuseTex.magFilter = LinearFilter;
    diffuseTex.minFilter = LinearMipmapLinearFilter;
    diffuseTex.generateMipmaps = true;
    diffuseTex.flipY = false;
    diffuseTex.needsUpdate = true;

    // Rebuild the bone hierarchy.
    const boneObjs = model.bones.map(() => new Bone());
    model.bones.forEach((sb, i) => {
      const b = boneObjs[i];
      b.name = sb.name;
      b.position.fromArray(sb.position);
      b.quaternion.fromArray(sb.quaternion);
      b.scale.fromArray(sb.scale);
    });

    const characterRoot = new Group();
    characterRoot.matrixAutoUpdate = false;
    characterRoot.matrix.fromArray(Array.from(model.rootMatrix));
    model.bones.forEach((sb, i) => {
      if (sb.parent >= 0) {
        boneObjs[sb.parent].add(boneObjs[i]);
      } else {
        characterRoot.add(boneObjs[i]);
      }
    });
    scene.add(characterRoot);

    const boneInverses: Matrix4[] = [];
    for (let i = 0; i < boneObjs.length; i++) {
      boneInverses.push(
        new Matrix4().fromArray(
          Array.from(model.boneInverses.subarray(i * 16, i * 16 + 16)),
        ),
      );
    }
    const skeleton = new Skeleton(boneObjs, boneInverses);

    // Rebuild the skinned geometry.
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(model.positions, 3));
    if (model.uvs) {
      geometry.setAttribute('uv', new BufferAttribute(model.uvs, 2));
    }
    geometry.setAttribute(
      'skinIndex',
      new BufferAttribute(model.skinIndices, 4),
    );
    geometry.setAttribute(
      'skinWeight',
      new BufferAttribute(model.skinWeights, 4),
    );
    if (model.indices) {
      geometry.setIndex(new BufferAttribute(model.indices, 1));
    }

    const material = new MeshBasicNodeMaterial();
    material.colorNode = textureNode(diffuseTex, uv());

    const skinnedMesh = new SkinnedMesh(geometry, material);
    skinnedMesh.matrixAutoUpdate = false;
    skinnedMesh.matrix.fromArray(Array.from(model.meshMatrix));
    skinnedMesh.frustumCulled = false;
    scene.add(skinnedMesh);
    skinnedMesh.bind(
      skeleton,
      new Matrix4().fromArray(Array.from(model.bindMatrix)),
    );

    // Rebuild the animation clip and start it.
    const tracks = model.tracks.map(t => {
      if (t.type === 'quaternion') {
        return new QuaternionKeyframeTrack(
          t.name,
          t.times as unknown as number[],
          t.values as unknown as number[],
          t.interpolation as any,
        );
      }
      if (t.type === 'number') {
        return new NumberKeyframeTrack(
          t.name,
          t.times as unknown as number[],
          t.values as unknown as number[],
          t.interpolation as any,
        );
      }
      return new VectorKeyframeTrack(
        t.name,
        t.times as unknown as number[],
        t.values as unknown as number[],
        t.interpolation as any,
      );
    });
    const clip = new AnimationClip('clip', model.duration, tracks);
    const mixer = new AnimationMixer(characterRoot);
    mixer.clipAction(clip).play();

    const sphereGeometry = new SphereGeometry(0.3, 32, 16);
    const portals = new Group();
    scene.add(portals);

    function addBackdropSphere(
      backdropNode: unknown,
      backdropAlphaNode: unknown = null,
    ) {
      const distance = 1;
      const id = portals.children.length;
      const rotation = MathUtils.degToRad(id * 45);

      const sphereMaterial = new MeshBasicNodeMaterial();
      (sphereMaterial as any).backdropNode = backdropNode;
      (sphereMaterial as any).backdropAlphaNode = backdropAlphaNode;
      sphereMaterial.transparent = true;

      const sphere = new Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(
        Math.cos(rotation) * distance,
        1,
        Math.sin(rotation) * distance,
      );
      portals.add(sphere);
    }

    addBackdropSphere(hue(viewportSharedTexture().bgr, oscSine().mul(Math.PI)));
    addBackdropSphere(viewportSharedTexture().rgb.oneMinus());
    addBackdropSphere(grayscale(viewportSharedTexture().rgb));
    addBackdropSphere(saturation(viewportSharedTexture().rgb, 10), oscSine());
    addBackdropSphere(
      blendOverlay(viewportSharedTexture().rgb, checker(uv().mul(10))),
    );
    addBackdropSphere(
      viewportSharedTexture(viewportSafeUV(viewportUV.mul(40).floor().div(40))),
    );
    addBackdropSphere(
      viewportSharedTexture(
        viewportSafeUV(viewportUV.mul(80).floor().div(80)),
      ).add(color(0x0033ff)),
    );
    addBackdropSphere(vec3(0, 0, viewportSharedTexture().b));

    const renderer = makeWebGPURenderer(context, device, { antialias: false });

    globalThis.renderer = renderer;
    globalThis.stopRender = false;

    let lastTimestamp = 0;
    function animate(timestamp: number) {
      if (globalThis.stopRender) {
        return;
      }
      const delta =
        lastTimestamp === 0 ? 0 : (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      mixer.update(delta);
      portals.rotation.y += delta * 0.5;

      renderer.render(scene, camera);
      context!.present();
      requestAnimationFrame(animate);
    }

    renderer
      .init()
      .then(() => {
        requestAnimationFrame(animate);
      })
      .catch((e: unknown) => {
        console.error('renderer.init failed', e);
      });
  });
}

function cleanupScene(schedule: (worklet: () => void) => void) {
  return () => {
    schedule(() => {
      'worklet';
      globalThis.stopRender = true;
      globalThis.renderer = null;
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadLabel: {
    marginLeft: 10,
    fontWeight: '600',
    color: '#333',
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
