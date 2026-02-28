function applyEvent(state, event) {
  switch(event.event_type) {

    case 'AccountCreated':
      state.balance = event.event_data.initialBalance;
      state.status = 'OPEN';
      state.ownerName = event.event_data.ownerName;
      state.currency = event.event_data.currency;
      break;

    case 'MoneyDeposited':
      state.balance += event.event_data.amount;
      break;

    case 'MoneyWithdrawn':
      state.balance -= event.event_data.amount;
      break;

    case 'AccountClosed':
      state.status = 'CLOSED';
      break;
  }

  return state;
}