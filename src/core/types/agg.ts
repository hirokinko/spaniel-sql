import type { Expr } from '../ast.js';
import { asAgg, type AggExpr } from './brand.js';

type AggName = 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG';

const call = (name: AggName, args: Expr[], distinct?: boolean) =>
  asAgg({ kind: 'call', name, args, distinct });

export const ag = {
  countAll(): AggExpr {
    return call('COUNT', [{ kind: 'literal', value: 1 }]);
  },
  count(e: Expr, o?: { distinct?: boolean }): AggExpr {
    return call('COUNT', [e], o?.distinct);
  },
  sum(e: Expr): AggExpr {
    return call('SUM', [e]);
  },
  min(e: Expr): AggExpr {
    return call('MIN', [e]);
  },
  max(e: Expr): AggExpr {
    return call('MAX', [e]);
  },
  avg(e: Expr): AggExpr {
    return call('AVG', [e]);
  },
};
