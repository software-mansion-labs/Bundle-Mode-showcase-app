import { Image } from 'react-native';
import { useEffect, useState } from 'react';
import type { AnimationClip, Camera, Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface GLTF {
  animations: AnimationClip[];
  scene: Group;
  scenes: Group[];
  cameras: Camera[];
  asset: {
    copyright?: string;
    generator?: string;
    version?: string;
    minVersion?: string;
  };
}

export const resolveAsset = (mod: ReturnType<typeof require>): string =>
  Image.resolveAssetSource(mod).uri;

export const useRawBytes = (asset: ReturnType<typeof require>) => {
  const url = resolveAsset(asset);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  useEffect(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        setBytes(new Uint8Array(xhr.response as ArrayBuffer));
      } else {
        console.error('raw bytes load failed', url, xhr.status);
      }
    };
    xhr.onerror = () => console.error('raw bytes xhr error', url);
    xhr.send();
  }, [url]);
  return bytes;
};

export const useGLTF = (asset: ReturnType<typeof require>) => {
  const url = resolveAsset(asset);
  const [gltf, setGLTF] = useState<GLTF | null>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (model: GLTF) => setGLTF(model),
      undefined,
      (err: unknown) => console.error('GLTF load error', err),
    );
  }, [url]);
  return gltf;
};
