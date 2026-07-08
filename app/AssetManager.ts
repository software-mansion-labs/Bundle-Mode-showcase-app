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
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => {
      const json = JSON.parse(xhr.response as string);
      delete json.images;
      delete json.textures;
      delete json.samplers;
      for (const material of json.materials ?? []) {
        delete material.normalTexture;
        delete material.occlusionTexture;
        delete material.emissiveTexture;
        delete material.extensions;
        const pbr = material.pbrMetallicRoughness;
        if (pbr) {
          delete pbr.baseColorTexture;
          delete pbr.metallicRoughnessTexture;
        }
      }
      const path = url.slice(0, url.lastIndexOf('/') + 1);
      new GLTFLoader().parse(
        JSON.stringify(json),
        path,
        (model: GLTF) => setGLTF(model),
        (err: unknown) => console.error('GLTF parse error', err),
      );
    };
    xhr.onerror = () => console.error('GLTF xhr error', url);
    xhr.send();
  }, [url]);
  return gltf;
};
