import { Image } from 'react-native';
import { useEffect, useState } from 'react';
import type {
  AnimationClip,
  Camera,
  Group,
  Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

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

export const useRGBE = (asset: ReturnType<typeof require>) => {
  const url = resolveAsset(asset);
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    const loader = new RGBELoader();
    loader.load(
      url,
      (tex: Texture) => setTexture(tex),
      undefined,
      (err: unknown) => console.error('RGBE load error', err),
    );
  }, [url]);
  return texture;
};
