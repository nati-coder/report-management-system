/** A small approved-format outline used by several tests: 1 Immunization → 1.1 / 1.2 (persons), 2 Coverage (%). */
export const schema = {
  nodes: [
    { code: '1', title: 'Immunization', measurement: 'Persons', children: [
      { code: '1.1', title: 'Children', measurement: 'Persons', children: [] },
      { code: '1.2', title: 'Women', measurement: 'Persons', children: [] },
    ] },
    { code: '2', title: 'Coverage', measurement: '%', children: [] },
    { code: '3', title: 'Heading only', measurement: '', children: [
      { code: '3.1', title: 'Sessions', measurement: 'Sessions', children: [] },
    ] },
  ],
};
