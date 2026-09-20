/** Дата в формате YYYY-MM-DD */
export type ISODate = string;
/** Время в формате HH:mm */
export type HHMM = string;

export type RepeatType = 'none' | 'weekdays' | 'days' | 'weeks' | 'monthly';

export interface Repeat {
  type: RepeatType;
  /** Для 'weekdays': дни недели, 1 = пн … 7 = вс */
  days?: number[];
  /** Для 'days' и 'weeks': каждые N дней/недель */
  interval?: number;
  /** Последний день серии включительно */
  until?: ISODate;
}

export interface Task {
  id: string;
  title: string;
  /** Дата разовой задачи или дата начала серии */
  date: ISODate;
  start?: HHMM;
  end?: HHMM;
  color: string;
  note?: string;
  repeat: Repeat;
  /** Даты, в которые серия пропускается */
  exceptions?: ISODate[];
}

export interface CalendarData {
  tasks: Task[];
  /** taskId → даты, в которые задача отмечена выполненной */
  done: Record<string, ISODate[]>;
  updatedAt: number;
}

export interface Occurrence {
  task: Task;
  date: ISODate;
}

export type EditScope = 'one' | 'series';
