import { IsOptional, IsString } from 'class-validator';

export class UpdateSeafarerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  status?: string; // e.g., 'Active', 'Deactivated'
}
