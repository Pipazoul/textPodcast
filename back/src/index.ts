import { Queue, Worker } from 'bullmq'
import { createAudio } from './jobs/createAudio';

const redisConfiguration = {
   connection: {
     host: "redis",
     port: 6379,
   }
 }

 const worker = new Worker('createAudio', async job => {
   return createAudio();
 }
, redisConfiguration);

console.log("worker started");
const queue = new Queue('createAudio', redisConfiguration);

// delay 2 minutes
queue.add("currentJob", {}, { delay: 120000 });


// log completed jobs and starting ones
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
  queue.add("currentJob", {}, { delay: 120000 });
 });

 worker.on('failed', (job, err) => {
   console.log(`Job failed with ${err.message}`);
 });
