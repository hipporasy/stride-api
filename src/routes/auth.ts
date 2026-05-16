import { Router } from 'express';
import passport from 'passport';

const router = Router();

router.get('/strava', passport.authenticate('strava', {
  scope: ['read', 'activity:read'],
}));

router.get(
  '/strava/callback',
  passport.authenticate('strava', { failureRedirect: '/auth/strava' }),
  (req, res) => {
    res.json({ ok: true, userId: req.user?.userId, refId: req.user?.refId });
  },
);

export default router;
