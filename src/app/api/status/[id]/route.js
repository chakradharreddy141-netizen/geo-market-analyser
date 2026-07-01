// GET /api/status/[id] — Server-Sent Events for real-time progress
import { getJob, addListener, removeListener } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialData = JSON.stringify({
        status: job.status,
        progress: job.progress,
        steps: job.steps,
        location: job.location,
        targetSector: job.targetSector,
      });
      controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

      // If already completed, close immediately
      if (job.status === 'completed' || job.status === 'failed') {
        controller.close();
        return;
      }

      // Listen for updates
      const listener = (update) => {
        try {
          const data = JSON.stringify(update);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Close when done
          if (update.status === 'completed' || update.status === 'failed') {
            setTimeout(() => {
              try { controller.close(); } catch (e) {}
            }, 100);
            removeListener(id, listener);
          }
        } catch (e) {
          removeListener(id, listener);
        }
      };

      addListener(id, listener);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeListener(id, listener);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
