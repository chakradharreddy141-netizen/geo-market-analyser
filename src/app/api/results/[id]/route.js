// GET /api/results/[id] — Fetch completed analysis results
import { getJob } from '@/lib/store';

export async function GET(request, { params }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status === 'running' || job.status === 'pending') {
    return Response.json(
      { status: job.status, progress: job.progress, message: 'Analysis still in progress' },
      { status: 202 }
    );
  }

  if (job.status === 'failed') {
    return Response.json({ status: 'failed', error: job.error }, { status: 500 });
  }

  return Response.json({
    status: 'completed',
    results: job.results,
  });
}
