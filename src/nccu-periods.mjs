export function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

const period = (code, start, end, special = false) => ({
  code,
  start: toMinutes(start),
  end: toMinutes(end),
  time: `${start}–${end}`,
  special,
});

export const NCCU_PERIODS = [
  period('A', '06:10', '07:00', true),
  period('B', '07:10', '08:00', true),
  period('1', '08:10', '09:00'),
  period('2', '09:10', '10:00'),
  period('3', '10:10', '11:00'),
  period('4', '11:10', '12:00'),
  period('C', '12:10', '13:00'),
  period('D', '13:10', '14:00'),
  period('5', '14:10', '15:00'),
  period('6', '15:10', '16:00'),
  period('7', '16:10', '17:00'),
  period('8', '17:10', '18:00'),
  period('E', '18:10', '19:00'),
  period('F', '19:10', '20:00'),
  period('G', '20:10', '21:00'),
  period('H', '21:10', '22:00', true),
];
