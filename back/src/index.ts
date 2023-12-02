import { Queue, Worker } from 'bullmq'
import { createAudio } from './jobs/createAudio';

const redisConfiguration = {
   connection: {
     host: "redis",
     port: 6379,
   }
 }

 const worker = new Worker('postImage', async job => {
   //return createAudio();
 }
, redisConfiguration);


createAudio();
const queue = new Queue('postImage', redisConfiguration);

//const repeat = { pattern: '*/15 * * * *' };
queue.add("currentJob", { delay: 10000 })


// log completed jobs and starting ones
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
  //queue.add("currentJob", { delay: 10000 })

 });

 worker.on('failed', (job, err) => {
   console.log(`Job failed with ${err.message}`);
 });
