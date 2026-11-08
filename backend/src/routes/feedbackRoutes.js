import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import * as c from '../controllers/feedbackController.js';

const router = Router();
router.use(authenticate);

// Who may write which kind is decided in the controller (it depends on the kind).
router.get('/', validate(schemas.feedbackQuery, 'query'), c.listFeedback);
router.post('/', validate(schemas.feedback), audit('feedback.create', 'review_feedback'), c.addFeedback);

export default router;
