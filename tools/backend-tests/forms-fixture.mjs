import { f, fixtureSQL } from "./giving-fixture.mjs";
export { f };
export const formsFixtureSQL =
  fixtureSQL +
  `
insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.admin}',k from unnest(array['forms.read','forms.create','forms.edit','forms.publish','forms.archive','forms.submissions.read','forms.submissions.export','forms.payment.configure','people.update'])k;
insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','forms.read'),('${f.org}','${f.reader}','forms.edit');
update giving_funds set is_public=true where organization_id='${f.org}';
`;
export const definition = () => ({
  sections: [
    {
      key: "main",
      title: "Synthetic registration",
      columns: 2,
      fields: [
        {
          key: "name",
          type: "name",
          label: "Your name",
          required: true,
          width: "half",
        },
        {
          key: "email",
          type: "email",
          label: "Email",
          required: true,
          width: "half",
        },
        { key: "children", type: "yes_no", label: "Children?" },
        {
          key: "signature",
          type: "signature",
          label: "Typed signature",
          agreement: {
            text: "Synthetic agreement only",
            version: "1",
            purpose: "event_acknowledgment",
          },
        },
        {
          key: "consent",
          type: "consent",
          label: "Optional news consent",
          agreement: {
            text: "Synthetic optional news",
            version: "1",
            purpose: "news",
          },
        },
      ],
    },
    {
      key: "children_section",
      title: "Children",
      columns: 1,
      fields: [
        {
          key: "child_count",
          type: "number",
          label: "Child count",
          required: true,
          validation: { min: 1, max: 20 },
        },
      ],
    },
  ],
  conditions: [
    {
      source: "children",
      operator: "equals",
      value: true,
      action: "show",
      target: "children_section",
    },
  ],
  settings: {
    branding: "champion-life",
    timezone: "America/Chicago",
    public_available: true,
    success_message: "Synthetic response received",
  },
  payment: {},
});
export const createPayload = (slug = "synthetic-form", d = definition()) => ({
  name: "Synthetic form",
  type: "registration",
  slug,
  definition: d,
});
export function paymentDefinition(classification = "donation") {
  const d = definition();
  d.sections[0].fields.push(
    { key: "fund", type: "fund", label: "Fund", required: true },
    { key: "amount", type: "gift_amount", label: "Amount", required: true },
    { key: "payment", type: "payment", label: "Payment" },
  );
  d.payment = {
    enabled: true,
    required: true,
    classification,
    currency: "USD",
    allowed_funds: [f.mainFund, f.youthFund],
    default_fund: f.mainFund,
    minimum_minor: "100",
    amount_key: "amount",
    fund_key: "fund",
  };
  return d;
}
