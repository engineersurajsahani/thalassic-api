import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class VerifyDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['Verified', 'Rejected', 'Re-upload'])
  status: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
