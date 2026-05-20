import { Router } from "express";
import {
	importWellfound,
	previewWellfound,
} from "../controllers/external.controller";
import { protect, requireRole } from "../middleware/auth";

const router = Router();

// All external connector routes require authentication for now
router.use(protect);

// Preview normalized jobs from Wellfound (does not save to DB)
router.get("/wellfound/preview", previewWellfound);

// Import normalized jobs into the DB (upsert). Requires recruiter role.
router.post("/wellfound/import", requireRole("recruiter"), importWellfound);

export default router;
