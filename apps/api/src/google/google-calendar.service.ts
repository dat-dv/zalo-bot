import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

/** Payload of a bot "create calendar event" pending action (kept in Redis while awaiting approval). */
export interface CreateEventOptions {
  summary: string;
  description?: string;
  startDateTime: string; // ISO String (e.g. 2026-08-23T09:00:00+07:00)
  endDateTime: string; // ISO String (e.g. 2026-08-23T10:00:00+07:00)
  location?: string;
  reminderMinutes?: number[];
  timeZone?: string;
}

/** Google Calendar copy of a `calendar_events` row. Built by `toGoogleEventBody`. */
export type GoogleEventBody = calendar_v3.Schema$Event;

const PAGE_SIZE = 250;
const MAX_PAGES = 10;

/**
 * Thin Google Calendar client. Events live in `calendar_events` (see `CalendarService`);
 * this service only writes and reads their Google copy in the `primary` calendar of the
 * account behind `GoogleAuthService.getOAuth2Client(userId)`.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly authService: GoogleAuthService) {}

  private getCalendarClient(userId?: number | string): calendar_v3.Calendar {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new BadRequestException(
        'Tài khoản Google Calendar của bạn chưa được kết nối. Vui lòng gõ /login trên bot để liên kết tài khoản Google cá nhân.',
      );
    }
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Every event overlapping [timeMin, timeMax), recurring ones expanded. Throws unless all
   * pages were read, so callers can trust a missing event as deleted on Google.
   */
  public async listEventsInRange(
    range: { timeMin: Date; timeMax: Date },
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = this.getCalendarClient(userId);
    const items: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: range.timeMin.toISOString(),
        timeMax: range.timeMax.toISOString(),
        maxResults: PAGE_SIZE,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      });
      items.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) return items;
    }
    throw new Error(`Google Calendar returned more than ${MAX_PAGES * PAGE_SIZE} events.`);
  }

  public async insertEvent(
    body: GoogleEventBody,
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendarClient(userId);
    const res = await calendar.events.insert({ calendarId: 'primary', requestBody: body });
    this.logger.log(`Created Google Calendar event ${res.data.id} for user ${userId ?? 'shared'}`);
    return res.data;
  }

  public async patchEvent(
    eventId: string,
    body: GoogleEventBody,
    userId?: number | string,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendarClient(userId);
    const res = await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: body });
    return res.data;
  }

  public async deleteEvent(eventId: string, userId?: number | string): Promise<boolean> {
    const calendar = this.getCalendarClient(userId);
    await calendar.events.delete({ calendarId: 'primary', eventId });
    this.logger.log(`Deleted Google Calendar event ${eventId} for user ${userId ?? 'shared'}`);
    return true;
  }
}
