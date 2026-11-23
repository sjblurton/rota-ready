export const en = {
  staffLinkEmail: {
    subject: 'Your Shifts at {{venueName}} for the Week of {{week}}',
    body: [
      'Hi {{firstName}},',
      '',
      '{{venueName}} has published the Rota for the Week of {{week}}.',
      '',
      'See your Shifts, and Confirm or Decline each one, on your Staff Link:',
      '{{staffLinkUrl}}',
      '',
      "This link is just for you, so please don't share it.",
    ].join('\n'),
  },
  shiftUpdatesEmail: {
    subject: 'Changes to your Shifts at {{venueName}} for the Week of {{week}}',
    body: [
      'Hi {{firstName}},',
      '',
      '{{venueName}} has updated your Shifts for the Week of {{week}}:',
      '',
      '{{changes}}',
      '',
      'See your Shifts, and Confirm or Decline the ones that changed, on your Staff Link:',
      '{{staffLinkUrl}}',
      '',
      "This link is just for you, so please don't share it.",
    ].join('\n'),
    added: '- {{day}}, {{times}}: new',
    changed: '- {{day}}, {{times}}: was {{was}}',
    removed: "- {{day}}, {{times}}: removed, so you don't need to work it",
  },
};
