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
};
