import { useEffect, useState } from 'react';
import {
  runOnUI,
  scheduleOnRuntime,
  type WorkletRuntime,
} from 'react-native-worklets';
import { WebGPURenderer } from 'three/webgpu';

export function initWebGPU(runtime: WorkletRuntime) {
  const navigator = globalThis.navigator as NavigatorGPU;
  const GPUBufferUsage = globalThis.GPUBufferUsage;
  const GPUColorWrite = globalThis.GPUColorWrite;
  const GPUMapMode = globalThis.GPUMapMode;
  const GPUShaderStage = globalThis.GPUShaderStage;
  const GPUTextureUsage = globalThis.GPUTextureUsage;

  scheduleOnRuntime(runtime, () => {
    'worklet';

    if (globalThis.self) {
      return;
    }
    globalThis.self = globalThis;
    globalThis.navigator = { gpu: navigator.gpu } as NavigatorGPU;
    globalThis.GPUBufferUsage = GPUBufferUsage;
    globalThis.GPUColorWrite = GPUColorWrite;
    globalThis.GPUMapMode = GPUMapMode;
    globalThis.GPUShaderStage = GPUShaderStage;
    globalThis.GPUTextureUsage = GPUTextureUsage;
    globalThis.setImmediate =
      globalThis.requestAnimationFrame as typeof setImmediate;
  });
}

export function makeWebGPURenderer(
  context: GPUCanvasContext,
  device?: GPUDevice,
  { antialias = true }: { antialias?: boolean } = {},
): WebGPURenderer {
  'worklet';
  class ReactNativeCanvas {
    #canvas: any;

    constructor(canvas: any) {
      this.#canvas = canvas;
    }
    get width() {
      return this.#canvas.width;
    }
    set width(width: number) {
      this.#canvas.width = width;
    }
    get height() {
      return this.#canvas.height;
    }
    set height(height: number) {
      this.#canvas.height = height;
    }
    get clientWidth() {
      return this.#canvas.width;
    }
    set clientWidth(width: number) {
      this.#canvas.width = width;
    }
    get clientHeight() {
      return this.#canvas.height;
    }
    set clientHeight(height: number) {
      this.#canvas.height = height;
    }
    addEventListener(_type: any, _listener: any) {}
    removeEventListener(_type: any, _listener: any) {}
    dispatchEvent(_event: any) {}
    setPointerCapture() {}
    releasePointerCapture() {}
    getContext(type: string): GPUCanvasContext | null {
      if (type === 'webgpu') {
        return context;
      }
      return null;
    }
  }

  return new WebGPURenderer({
    antialias,
    canvas: new ReactNativeCanvas(context.canvas),
    context,
    device,
  });
}

export function useBusyJS() {
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!working) {
      return;
    }
    let job = requestAnimationFrame(work);
    function work() {
      const sleepTime = 250;
      const now = performance.now();
      while (performance.now() - now < sleepTime) {
        // Busy-wait for a short time to simulate work
      }
      job = requestAnimationFrame(work);
    }
    return () => {
      cancelAnimationFrame(job);
    };
  }, [working]);

  return function toggleWorking() {
    setWorking(prev => !prev);
  };
}

declare global {
  var self: typeof globalThis;
  var navigator: NavigatorGPU;
  var renderer: WebGPURenderer | null;
  var lastFrame: number;
  var _WORKLET: boolean | undefined;
}
