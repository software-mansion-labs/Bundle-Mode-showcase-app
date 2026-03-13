import {
  createWorkletRuntime,
  scheduleOnRuntime,
  scheduleOnRN,
} from 'react-native-worklets';
import remend from 'remend';

const remendConfig = {
  bold: true,
  italic: true,
  boldItalic: true,
  strikethrough: true,
  links: true,
  linkMode: 'text-only' as const,
  images: true,
  inlineCode: true,
  katex: false,
  setextHeadings: true,
};

const remendRuntime = createWorkletRuntime('remend-processor');

export function processRemendInWorklet(
  markdown: string,
  onComplete: (result: string) => void
) {
  scheduleOnRuntime(remendRuntime, () => {
    'worklet';
    const result = remend(markdown, remendConfig);
    scheduleOnRN(onComplete, result);
  });
}
