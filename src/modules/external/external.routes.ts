import { Router } from 'express';
import { getExternalData } from './external.controller';

const router = Router();

router.get('/external-a', getExternalData);

export default router;
