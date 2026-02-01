import { Router } from 'express';
import { handleWebhook } from './webhook.controller';

const router = Router();

router.post('/webhook', handleWebhook);

export default router;
