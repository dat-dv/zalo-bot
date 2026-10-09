import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

export interface CreateEventOptions {
  summary: string;
  description?: string;
  startDateTime: string; // ISO String (e.g. 2026-08-23T09:00:00+07:00)
  endDateTime: string; // ISO String (e.g. 2026-08-23T10:00:00+07:00)
  location?: string;
  reminderMinutes?: number[];
  timeZone?: string;
}

export interface UpdateEventOptions {
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  timeZone?: string;
}

export interface ListEventsOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly authService: GoogleAuthService,
    private readonly configService: ConfigService,
  ) {}

  private getCalendarClient(userId?: number | string): calendar_v3.Calendar {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new Error(
        'Tài khoản Google Calendar của bạn chưa được kết nối. Vui lòng gõ /login trên bot để liên kết tài khoản Google cá nhân.',
      );
    }
    return google.calendar({ version: 'v3', auth });
  }

  public async listEvents(
    options: ListEventsOptions = {},
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = this.getCalendarClient(userId);
    const timeZone = this.configService.getOrThrow<string>('timezone');

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax,
      maxResults: options.maxResults || 20,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone,
      q: options.query,
    });

    return res.data.items || [];
  }

  public async createEvent(
    options: CreateEventOptions,
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendarClient(userId);
    const defaultTimeZone = this.configService.getOrThrow<string>('timezone');
    const timeZone = options.timeZone || defaultTimeZone;

    // Multi-Reminder 4 mốc: 60p, 30p, 10p, 0p
    const reminderMinutes =
      options.reminderMinutes && options.reminderMinutes.length > 0
        ? options.reminderMinutes
        : [60, 30, 10, 0];

    const overrides = reminderMinutes.map((minutes) => ({
      method: 'popup',
      minutes,
    }));

    const eventPayload: calendar_v3.Schema$Event = {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: {
        dateTime: options.startDateTime,
        timeZone,
      },
      end: {
        dateTime: options.endDateTime,
        timeZone,
      },
      reminders: {
        useDefault: false,
        overrides,
      },
    };

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventPayload,
    });

    this.logger.log(
      `Created Google Calendar event: "${options.summary}" for user ${userId || 'default'} (ID: ${res.data.id})`,
    );
    return res.data;
  }

  public async deleteEvent(eventId: string, userId?: number | string): Promise<boolean> {
    const calendar = this.getCalendarClient(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    this.logger.log(`Deleted Google Calendar event: ${eventId} for user ${userId || 'default'}`);
    return true;
  }

  public async updateEvent(
    eventId: string,
    options: UpdateEventOptions,
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendarClient(userId);
    const existing = await this.getEvent(eventId, userId);
    const timeZone = options.timeZone || this.configService.getOrThrow<string>('timezone');
    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: options.summary ?? existing.summary,
        description: options.description ?? existing.description,
        location: options.location ?? existing.location,
        start: options.startDateTime
          ? { dateTime: options.startDateTime, timeZone }
          : existing.start,
        end: options.endDateTime ? { dateTime: options.endDateTime, timeZone } : existing.end,
      },
    });
    return res.data;
  }

  public async getEvent(
    eventId: string,
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendarClient(userId);
    const res = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });
    return res.data;
  }
}
