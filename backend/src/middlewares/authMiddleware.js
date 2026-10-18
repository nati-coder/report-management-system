import passport from '../../config/passport.js';
import { ApiError } from '../utils/apiResponse.js';

/** Verifies the Bearer JWT and attaches the DB user to req.user */
export const authenticate = (req, _res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return next(ApiError.unauthorized('Invalid or expired token'));
    req.user = user;
    next();
  })(req, _res, next);
};
