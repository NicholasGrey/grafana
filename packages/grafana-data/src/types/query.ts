export enum DataTopic {
  Annotations = 'annotations',
}

/** This will identify the datasource */
export interface DatasourceRef {
  type?: string;
  uid?: string;
}

/**
 * These are the common properties available to all queries in all datasources
 * Specific implementations will *extend* this interface adding the required properties
 * for the given context
 */
export interface DataQuery {
  /**
   * A - Z
   */
  refId: string;

  /**
   * true if query is disabled (ie should not be returned to the dashboard)
   */
  hide?: boolean;

  /**
   * Unique, guid like, string used in explore mode
   */
  key?: string;

  /**
   * Specify the query flavor
   */
  queryType?: string;

  /**
   * The data topic results should be attached to
   *
   * RUNTIME!!! (should not be saved in JSON!!!!)
   */
  dataTopic?: DataTopic;

  /**
   * For mixed data sources the selected datasource is on the query level.
   * For non mixed scenarios this is undefined.
   */
  datasource?: DatasourceRef;
}