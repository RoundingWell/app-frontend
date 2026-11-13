import { filter, keys, map, object } from 'underscore';
import { Radio } from 'marionette';
import { routeTable } from '@mnjs/router';

const AREAS = {
  patients: {
    nav: 'PatientsApp',
    load: () => import('js/apps/patients/patients-main_app'),
  },
  dashboards: {
    nav: 'DashboardsApp',
    permission: 'dashboards:view',
    load: () => import('js/apps/dashboards/dashboards-main_app'),
  },
  clinicians: {
    nav: 'CliniciansApp',
    permission: 'clinicians:manage',
    load: () => import('js/apps/clinicians/clinicians-main_app'),
  },
  programs: {
    nav: 'ProgramsApp',
    permission: 'programs:manage',
    load: () => import('js/apps/programs/programs-main_app'),
  },
};

function isPermitted(name) {
  const { permission } = AREAS[name];
  return !permission || Radio.request('bootstrap', 'currentUser').can(permission);
}

// Area classes declare their routes, so permitted areas load before routing
// starts. Restricted areas are never mounted; their URLs are ordinary 404s.
export async function loadAreas() {
  const areas = await Promise.all(map(filter(keys(AREAS), isPermitted), async name => {
    return [name, (await AREAS[name].load()).default];
  }));
  return object(areas);
}

export function areaRoutes(areaTypes) {
  return routeTable({
    childApps: areaTypes,
    routes: map(areaTypes, (AreaApp, area) => ({
      path: '',
      mount: area,
      meta: {
        area,
        nav: AREAS[area].nav,
      },
    })),
  });
}
