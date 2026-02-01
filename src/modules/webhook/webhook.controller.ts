import { Request, Response } from 'express';
import { redisClient } from '../../config/redis';

const IDEMPOTENCY_TTL = 60 * 60; // 1 hour

export async function handleWebhook(
  req: Request,
  res: Response
) {
  const eventId = req.body?.event_id;

  if (!eventId) {
    return res.status(400).json({
      message: 'Missing event_id'
    });
  }

  const redisKey = `webhook:event:${eventId}`;

  //Check if event already processed
  const alreadyProcessed = await redisClient.get(redisKey);

  if (alreadyProcessed) {
    // IMPORTANT: still return 200
    return res.status(200).json({
      message: 'Duplicate event ignored'
    });
  }

  //Mark event as processed (idempotency)
  await redisClient.setEx(redisKey, IDEMPOTENCY_TTL, 'processed');

  //Process event (simulate async work)
  console.log('Processing webhook event:', eventId);
  console.log('Payload:', req.body);


  res.status(200).json({
    message: 'Webhook received'
  });
}
