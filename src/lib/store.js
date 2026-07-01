// In-memory job store for analysis jobs
// Each job: { id, status, location, targetSector, progress, steps, results, error, createdAt }

const jobs = new Map();

export function createJob(id, location, targetSector) {
  const job = {
    id,
    status: 'pending', // pending | running | completed | failed
    location,
    targetSector,
    progress: 0,
    steps: [],
    results: null,
    error: null,
    createdAt: Date.now(),
    listeners: new Set(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  // Notify all SSE listeners
  for (const listener of job.listeners) {
    try {
      listener({
        status: job.status,
        progress: job.progress,
        steps: job.steps,
        error: job.error,
      });
    } catch (e) {
      job.listeners.delete(listener);
    }
  }
  return job;
}

export function addStep(id, step) {
  const job = jobs.get(id);
  if (!job) return;
  job.steps.push({ ...step, timestamp: Date.now() });
  // Notify listeners
  for (const listener of job.listeners) {
    try {
      listener({
        status: job.status,
        progress: job.progress,
        steps: job.steps,
        currentStep: step,
      });
    } catch (e) {
      job.listeners.delete(listener);
    }
  }
}

export function addListener(id, callback) {
  const job = jobs.get(id);
  if (!job) return false;
  job.listeners.add(callback);
  return true;
}

export function removeListener(id, callback) {
  const job = jobs.get(id);
  if (!job) return;
  job.listeners.delete(callback);
}

// Cleanup jobs older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);
