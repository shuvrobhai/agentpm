import { ConversionStep } from './step.js';
import { ConversionContext, TransformStepResult } from './context.js';

export class ConversionPipeline {
  private steps: ConversionStep[];

  constructor(steps: ConversionStep[]) {
    this.steps = steps;
  }

  async execute(context: ConversionContext): Promise<TransformStepResult> {
    let currentContent = context.content;
    let isModified = false;

    for (const step of this.steps) {
      const stepCtx: ConversionContext = {
        ...context,
        content: currentContent,
      };

      const stepRes = await step.transform(stepCtx);
      currentContent = stepRes.content;
      if (stepRes.modified) {
        isModified = true;
      }
    }

    return {
      content: currentContent,
      modified: isModified,
    };
  }
}
