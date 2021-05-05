import {
  CoreApp,
  DataQueryRequest,
  DataSourceApi,
  PanelData,
  rangeUtil,
  ScopedVars,
  QueryRunnerOptions,
  QueryRunner as QueryRunnerSrv,
  LoadingState,
  compareArrayValues,
  compareDataFrameStructures,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { cloneDeep } from 'lodash';
import { from, Observable, ReplaySubject, Unsubscribable } from 'rxjs';
import { first } from 'rxjs/operators';
import { getNextRequestId } from './PanelQueryRunner';
import { preProcessPanelData, runRequest } from './runRequest';

export class QueryRunner implements QueryRunnerSrv {
  private subject: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;
  private lastResult?: PanelData;

  constructor() {
    this.subject = new ReplaySubject(1);
  }

  get(): Observable<PanelData> {
    return this.subject.asObservable();
  }

  run(options: QueryRunnerOptions): void {
    const {
      queries,
      timezone,
      datasource,
      panelId,
      app,
      dashboardId,
      timeRange,
      timeInfo,
      cacheTimeout,
      maxDataPoints,
      scopedVars,
      minInterval,
    } = options;

    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    const request: DataQueryRequest = {
      app: app ?? CoreApp.Unknown,
      requestId: getNextRequestId(),
      timezone,
      panelId,
      dashboardId,
      range: timeRange,
      timeInfo,
      interval: '',
      intervalMs: 0,
      targets: cloneDeep(queries),
      maxDataPoints: maxDataPoints,
      scopedVars: scopedVars || {},
      cacheTimeout,
      startTime: Date.now(),
    };

    // Add deprecated property
    (request as any).rangeRaw = timeRange.raw;

    from(getDataSource(datasource, request.scopedVars))
      .pipe(first())
      .subscribe({
        next: (ds) => {
          // Attach the datasource name to each query
          request.targets = request.targets.map((query) => {
            if (!query.datasource) {
              query.datasource = ds.name;
            }
            return query;
          });

          const lowerIntervalLimit = minInterval
            ? getTemplateSrv().replace(minInterval, request.scopedVars)
            : ds.interval;
          const norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);

          // make shallow copy of scoped vars,
          // and add built in variables interval and interval_ms
          request.scopedVars = Object.assign({}, request.scopedVars, {
            __interval: { text: norm.interval, value: norm.interval },
            __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
          });

          request.interval = norm.interval;
          request.intervalMs = norm.intervalMs;

          this.subscription = runRequest(ds, request).subscribe({
            next: (data) => {
              const results = preProcessPanelData(data, this.lastResult);

              // Indicate if the structure has changed since the last query
              let structureRev = 1;
              if (this.lastResult?.structureRev && this.lastResult.series) {
                structureRev = this.lastResult.structureRev;
                const sameStructure = compareArrayValues(
                  results.series,
                  this.lastResult.series,
                  compareDataFrameStructures
                );
                if (!sameStructure) {
                  structureRev++;
                }
              }
              results.structureRev = structureRev;
              this.lastResult = results;

              // Store preprocessed query results for applying overrides later on in the pipeline
              this.subject.next(this.lastResult);
            },
          });
        },
        error: (error) => console.error('PanelQueryRunner Error', error),
      });
  }

  cancel(): void {
    if (!this.subscription) {
      return;
    }

    this.subscription.unsubscribe();

    // If we have an old result with loading state, send it with done state
    if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
      this.subject.next({
        ...this.lastResult,
        state: LoadingState.Done,
      });
    }
  }

  destroy(): void {
    // Tell anyone listening that we are done
    if (this.subject) {
      this.subject.complete();
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

async function getDataSource(
  datasource: string | DataSourceApi | null,
  scopedVars: ScopedVars
): Promise<DataSourceApi> {
  if (datasource && (datasource as any).query) {
    return datasource as DataSourceApi;
  }
  return await getDatasourceSrv().get(datasource as string, scopedVars);
}