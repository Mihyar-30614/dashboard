import { Router } from 'express';
import { WIDGETS } from '../widgets/registry.js';
import { requireAuth } from '../auth/session.js';

const router = Router();
router.get('/', requireAuth, (_req, res) => res.json(WIDGETS));
export default router;
