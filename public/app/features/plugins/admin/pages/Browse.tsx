import React, { ReactElement } from 'react';
import { css } from '@emotion/css';
import { SelectableValue, GrafanaTheme2, UrlQueryValue } from '@grafana/data';
import { LoadingPlaceholder, Select, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { useLocation } from 'react-router-dom';
import { locationSearchToObject } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { useHistory } from '../hooks/useHistory';
import { PluginAdminRoutes, PluginListDisplayMode } from '../types';
import { Page as PluginPage } from '../components/Page';
import { HorizontalGroup } from '../components/HorizontalGroup';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';
import { getNavModel } from 'app/core/selectors/navModel';
import { useGetAllWithFilters } from '../state/hooks';
import { Sorters } from '../helpers';

export default function Browse({ route }: GrafanaRouteComponentProps): ReactElement | null {
  const location = useLocation();
  const locationSearch = locationSearchToObject(location.search);
  const navModelId = getNavModelId(route.routeName);
  const navModel = useSelector((state: StoreState) => getNavModel(state.navIndex, navModelId));
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const query = (locationSearch.q as string) || '';
  const filterBy = (locationSearch.filterBy as string) || 'installed';
  const filterByType = (locationSearch.filterByType as string) || 'all';
  const sortBy = (locationSearch.sortBy as Sorters) || Sorters.nameAsc;
  const displayMode = toDisplayMode(locationSearch.displayAs);
  const { isLoading, error, plugins } = useGetAllWithFilters({
    query,
    filterBy,
    filterByType,
    sortBy,
  });

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: string) => {
    history.push({ query: { filterBy: value } });
  };

  const onFilterByTypeChange = (value: string) => {
    history.push({ query: { filterByType: value } });
  };

  const onSearch = (q: any) => {
    history.push({ query: { filterBy: 'all', filterByType: 'all', q } });
  };

  const onDisplayMode = (value: string) => {
    history.push({ query: { displayAs: value } });
  };

  // How should we handle errors?
  if (error) {
    console.error(error.message);
    return null;
  }

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <PluginPage>
          <HorizontalGroup wrap>
            <SearchField value={query} onSearch={onSearch} />
            <HorizontalGroup wrap className={styles.actionBar}>
              <div>
                <RadioButtonGroup
                  value={filterByType}
                  onChange={onFilterByTypeChange}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'datasource', label: 'Data sources' },
                    { value: 'panel', label: 'Panels' },
                    { value: 'app', label: 'Applications' },
                  ]}
                />
              </div>
              <div>
                <RadioButtonGroup
                  value={filterBy}
                  onChange={onFilterByChange}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'installed', label: 'Installed' },
                  ]}
                />
              </div>
              <div>
                <Select
                  menuShouldPortal
                  width={24}
                  value={sortBy}
                  onChange={onSortByChange}
                  options={[
                    { value: 'nameAsc', label: 'Sort by name (A-Z)' },
                    { value: 'nameDesc', label: 'Sort by name (Z-A)' },
                    { value: 'updated', label: 'Sort by updated date' },
                    { value: 'published', label: 'Sort by published date' },
                    { value: 'downloads', label: 'Sort by downloads' },
                  ]}
                />
              </div>
              <div>
                <RadioButtonGroup
                  className={styles.displayAs}
                  value={displayMode}
                  onChange={onDisplayMode}
                  options={[
                    { value: 'table', icon: 'table', description: 'Display plugins in table' },
                    { value: 'list', icon: 'list-ul', description: 'Display plugins in list' },
                  ]}
                />
              </div>
            </HorizontalGroup>
          </HorizontalGroup>
          <div className={styles.listWrap}>
            {isLoading ? (
              <LoadingPlaceholder
                className={css`
                  margin-bottom: 0;
                `}
                text="Loading results"
              />
            ) : (
              <PluginList plugins={plugins} display={displayMode} />
            )}
          </div>
        </PluginPage>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actionBar: css`
    ${theme.breakpoints.up('xl')} {
      margin-left: auto;
    }
  `,
  listWrap: css`
    margin-top: ${theme.spacing(2)};
  `,
  displayAs: css`
    svg {
      margin-right: 0;
    }
  `,
});

// Because the component is used under multiple paths (/plugins and /admin/plugins) we need to get
// the correct navModel from the store
const getNavModelId = (routeName?: string) => {
  if (routeName === PluginAdminRoutes.HomeAdmin || routeName === PluginAdminRoutes.BrowseAdmin) {
    return 'admin-plugins';
  }

  return 'plugins';
};

function toDisplayMode(value: UrlQueryValue): PluginListDisplayMode {
  switch (value) {
    case PluginListDisplayMode.List:
      return PluginListDisplayMode.List;
    default:
      return PluginListDisplayMode.Table;
  }
}
