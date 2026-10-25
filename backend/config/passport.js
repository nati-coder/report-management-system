import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import env from './env.js';
import User from '../src/models/User.js';

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_SECRET,
      algorithms: ['HS256'],
    },
    async (payload, done) => {
      try {
        const { password_changed_at, ...user } = (await User.findForAuth(payload.sub)) || {};
        if (!user.id || !user.is_active) return done(null, false);
        // a token issued before the last password change/reset is no longer valid
        if (password_changed_at && payload.iat < Math.floor(new Date(password_changed_at).getTime() / 1000)) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

export default passport;
