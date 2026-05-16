import { RequestHandler, Request, Response } from 'express';
import { ZodSchema, z } from 'zod';
import { SessionUser } from '@/types';

// Builds the handler context from the builder's type params.
// Each param contributes its field only when it's not null/false.
type Ctx<
  TAuth extends boolean,
  TBody extends ZodSchema | null,
  TParams extends ZodSchema | null,
  TQuery extends ZodSchema | null,
> =
  ([TAuth] extends [true] ? { user: SessionUser } : unknown) &
  ([TBody] extends [ZodSchema] ? { body: z.infer<TBody> } : unknown) &
  ([TParams] extends [ZodSchema] ? { params: z.infer<TParams> } : unknown) &
  ([TQuery] extends [ZodSchema] ? { query: z.infer<TQuery> } : unknown) &
  { req: Request; res: Response };

class RouteBuilder<
  TAuth extends boolean,
  TBody extends ZodSchema | null,
  TParams extends ZodSchema | null,
  TQuery extends ZodSchema | null,
> {
  private constructor(
    private readonly _auth: TAuth,
    private readonly _body: TBody,
    private readonly _params: TParams,
    private readonly _query: TQuery,
  ) {}

  static init(): RouteBuilder<false, null, null, null> {
    return new RouteBuilder<false, null, null, null>(false, null, null, null);
  }

  auth(): RouteBuilder<true, TBody, TParams, TQuery> {
    return new RouteBuilder<true, TBody, TParams, TQuery>(true, this._body, this._params, this._query);
  }

  body<S extends ZodSchema>(schema: S): RouteBuilder<TAuth, S, TParams, TQuery> {
    return new RouteBuilder<TAuth, S, TParams, TQuery>(this._auth, schema, this._params, this._query);
  }

  params<S extends ZodSchema>(schema: S): RouteBuilder<TAuth, TBody, S, TQuery> {
    return new RouteBuilder<TAuth, TBody, S, TQuery>(this._auth, this._body, schema, this._query);
  }

  query<S extends ZodSchema>(schema: S): RouteBuilder<TAuth, TBody, TParams, S> {
    return new RouteBuilder<TAuth, TBody, TParams, S>(this._auth, this._body, this._params, schema);
  }

  handle<TResponse>(
    fn: (ctx: Ctx<TAuth, TBody, TParams, TQuery>) => Promise<TResponse>,
  ): RequestHandler {
    const { _auth, _body, _params, _query } = this;

    return (req: Request, res: Response, next): void => {
      if (_auth && !req.isAuthenticated()) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx: Record<string, any> = { req, res };

      if (_auth) ctx.user = req.user as SessionUser;

      if (_body) {
        const result = _body.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
          return;
        }
        ctx.body = result.data;
      }

      if (_params) {
        const result = _params.safeParse(req.params);
        if (!result.success) {
          res.status(400).json({ error: 'Invalid path parameters', details: result.error.flatten() });
          return;
        }
        ctx.params = result.data;
      }

      if (_query) {
        const result = _query.safeParse(req.query);
        if (!result.success) {
          res.status(400).json({ error: 'Invalid query parameters', details: result.error.flatten() });
          return;
        }
        ctx.query = result.data;
      }

      fn(ctx as Ctx<TAuth, TBody, TParams, TQuery>)
        .then(data => { if (data !== undefined) res.json(data); })
        .catch(next);
    };
  }
}

export function route(): RouteBuilder<false, null, null, null> {
  return RouteBuilder.init();
}
