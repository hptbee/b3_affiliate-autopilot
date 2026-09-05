import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { createLogger } from '@social-autopilot/core';

export interface ContentWorkflowParams {
  userId: string;
  topic: string;
}

export interface Env {
  CONTENT_WORKFLOW: Workflow;
  ENVIRONMENT: string;
}

/**
 * Stub workflow for long-running content generation pipelines.
 * Real implementation will orchestrate research → generate → validate → schedule.
 */
export class ContentGenerationWorkflow extends WorkflowEntrypoint<Env, ContentWorkflowParams> {
  async run(event: WorkflowEvent<ContentWorkflowParams>, step: WorkflowStep) {
    const logger = createLogger('workflow');
    const { userId, topic } = event.payload;

    logger.info('Workflow started', {
      operation: 'workflow.contentGeneration',
      entityId: userId,
      status: 'started',
    });

    const researchResult = await step.do('research-topic', async () => {
      return { topic, summary: `Research stub for: ${topic}` };
    });

    const contentResult = await step.do('generate-content', async () => {
      return {
        title: `Draft: ${topic}`,
        body: researchResult.summary,
      };
    });

    logger.info('Workflow completed', {
      operation: 'workflow.contentGeneration',
      entityId: userId,
      status: 'completed',
    });

    return contentResult;
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({
        service: 'social-autopilot-workflow',
        status: 'stub',
        message: 'Workflows are triggered programmatically, not via HTTP',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  },
};
