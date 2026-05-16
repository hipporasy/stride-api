import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, z } from 'zod';
import { SessionUser } from '@/types';

interface HandlerContext<B> {
  body: B;
  user: SessionUser;
  req: Request;
  res: Response;
}

type AsyncHandler<B> = (ctx: HandlerContext<B>) => Promise<void>;

export function handle<S extends ZodSchema>(schema: S, fn: AsyncHandler<z.infer<S>>): RequestHandler;
export function handle(fn: AsyncHandler<undefined>): RequestHandler;
export function handle<S extends ZodSchema>(
  schemaOrFn: S | AsyncHandler<undefined>,
  fn?: AsyncHandler<z.infer<S>>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = req.user as SessionUser;

    if (fn !== undefined) {
      const result = (schemaOrFn as S).safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
        return;
      }
      fn({ body: result.data, user, req, res }).catch(next);
    } else {
      (schemaOrFn as AsyncHandler<undefined>)({ body: undefined, user, req, res }).catch(next);
    }
  };
}
