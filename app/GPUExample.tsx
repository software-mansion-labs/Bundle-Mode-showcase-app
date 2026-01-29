import { Canvas, useCanvasRef, type CanvasRef } from 'react-native-wgpu';
import {
  BufferGeometryLoader,
  PerspectiveCamera,
  Scene,
  Color,
  MeshBasicMaterial,
  InstancedMesh,
  DynamicDrawUsage,
} from 'three';
import { StyleSheet, View, Button, Text } from 'react-native';
import { initWebGPU, makeWebGPURenderer, useBusyJS } from '../utils';
import { createWorkletRuntime, scheduleOnRuntime } from 'react-native-worklets';
import { mix, range, normalWorld, oscSine, time } from 'three/tsl';
import { useEffect, useState } from 'react';
import axios from 'axios';

const GPURuntime = createWorkletRuntime('gpu');

export default function GPUExample() {
  const ref = useCanvasRef();
  const toggleBusyJS = useBusyJS();

  useEffect(() => {
    renderOnWorkletRuntime(ref);
    return cleanupOnWorkletRuntime();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>This box is animated on the JS thread</Text>
      <StateAnimatedBox />
      <Button title="Toggle busy JS Thread" onPress={toggleBusyJS} />
      <Text style={styles.text}>
        This GPU animation is running on a background thread.
      </Text>
      <Text style={styles.text}>
        It fetches the geometry from the network with axios!
      </Text>
      <Canvas ref={ref} style={styles.gpu} />
    </View>
  );
}

async function renderOnWorkletRuntime(ref: React.RefObject<CanvasRef>) {
  const context = ref.current!.getContext('webgpu')!;
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();

  initWebGPU(GPURuntime);

  scheduleOnRuntime(GPURuntime, async () => {
    'worklet';

    if (globalThis.renderer) {
      return;
    }

    const { width, height } = context.canvas as typeof context.canvas & {
      width: number;
      height: number;
    };

    const amount = 2;
    const count = Math.pow(amount, 3);

    const camera = new PerspectiveCamera(60, width / height);
    camera.position.set(0, 0, 200);
    camera.lookAt(0, 0, 0);

    const scene = new Scene();

    const headURL =
      'https://threejs.org/examples/models/json/WaltHeadLo_buffergeometry.json';
    const codeURL =
      'https://threejs.org/examples/models/json/QRCode_buffergeometry.json';

    const urls = [headURL, codeURL];
    const chosenUrl = urls[Math.floor(Math.random() * urls.length)]!;

    const geometryJSON = await axios
      .get(chosenUrl)
      .then(res => res.data)
      .catch(e => console.error(e));

    const geometry = new BufferGeometryLoader().parse(geometryJSON);

    const randomColors = range(new Color(0x666666), new Color(0xcccccc));

    const material = new MeshBasicMaterial();

    material.colorNode = mix(normalWorld, randomColors, oscSine(time.mul(0.1)));

    geometry!.computeVertexNormals();

    const mesh = new InstancedMesh(geometry!, material, count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    scene.add(mesh);

    const renderer = makeWebGPURenderer(context, device);
    await renderer.init();

    let lastTimestamp = 0;

    function animate(timestamp: number) {
      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
        return;
      }

      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const rotationPerMs = (Math.PI * 2) / 8 / 1000;

      mesh.rotation.x += rotationPerMs * delta;
      mesh.rotation.y += (rotationPerMs * delta) / 2;
      mesh.rotation.z += (rotationPerMs * delta) / 4;

      renderer.render(scene, camera);
      context!.present();
    }

    await renderer.setAnimationLoop(animate);
  });
}

function cleanupOnWorkletRuntime() {
  scheduleOnRuntime(GPURuntime, async () => {
    'worklet';
    if (globalThis.renderer) {
      await globalThis.renderer.setAnimationLoop(null);
      globalThis.renderer = null;
    }
  });
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  gpu: {
    marginTop: 50,
    width: '100%',
    height: '50%',
  },
  box: {
    width: 50,
    height: 50,
    margin: 25,
    backgroundColor: 'blue',
  },
});
