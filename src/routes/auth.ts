import { Router } from 'express';
import passport from 'passport';
import { issueToken, verifyToken } from '../services/jwt';
import { requireAuth } from '../middleware/requireAuth';
import { SessionUser } from '../types';

const router = Router();

router.get('/strava', passport.authenticate('strava', {
  scope: ['read', 'activity:read'],
}));

router.get(
  '/strava/callback',
  passport.authenticate('strava', { failureRedirect: '/auth/strava' }),
  (req, res) => {
    const token = issueToken(req.user as SessionUser);
    res.redirect(302, `stridechainapp://auth/success?token=${encodeURIComponent(token)}`);
  },
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ stravaId: (req.user as SessionUser).stravaId });
});

export default router;
