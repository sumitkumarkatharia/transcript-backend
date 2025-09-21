// src/common/filters/prisma-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    switch (exception.code) {
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        message = 'The provided value is too long for the field';
        break;
      case 'P2001':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'Unique constraint violation';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint violation';
        break;
      case 'P2004':
        status = HttpStatus.BAD_REQUEST;
        message = 'A constraint failed on the database';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record to update not found';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error occurred';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
      timestamp: new Date().toISOString(),
    });
  }
}
