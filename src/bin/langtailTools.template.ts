import { CoreTool } from 'ai'
import { z } from 'zod'

type Streamable = unknown;
type Renderer<T extends Array<any>> = (...args: T) => Streamable | Generator<Streamable, Streamable, void> | AsyncGenerator<Streamable, Streamable, void>;
interface VercelAITool<PARAMETERS extends z.ZodTypeAny = any, RESULT = any> extends CoreTool<PARAMETERS, RESULT> {
  generate?: Renderer<[
    z.infer<PARAMETERS>,
    {
      toolName: string;
      toolCallId: string;
    }
  ]>;
}

export const toolsObject = {};  // replaced by generateTools.ts

type ToolsType = typeof toolsObject;
type ToolOverrides = {
  [K in keyof ToolsType]?: Partial<VercelAITool<typeof toolsObject[K]['parameters']>>
};

function tools<OVERRIDES extends ToolOverrides>(toolsOverride?: OVERRIDES): ToolsType & OVERRIDES {
  const mergedTools: any = {};

  for (const name in toolsObject) {
    const defaultTool = toolsObject[name as keyof ToolsType];
    const override = toolsOverride ? toolsOverride[name as keyof OVERRIDES] : {};
    mergedTools[name as keyof ToolsType] = { ...defaultTool, ...override };
  }

  return mergedTools as ToolsType & OVERRIDES;
}

export default tools