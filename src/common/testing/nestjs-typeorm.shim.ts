import { Inject } from '@nestjs/common';

export function getRepositoryToken(entity: any) {
  return `${typeof entity === 'string' ? entity : entity.name}Repository`;
}

export function InjectRepository(entity: any) {
  return Inject(getRepositoryToken(entity));
}

export class TypeOrmModule {
  static forRoot(options?: any) {
    return { module: TypeOrmModule, providers: [], exports: [] };
  }
  static forRootAsync(options?: any) {
    return { module: TypeOrmModule, providers: [], exports: [] };
  }
  static forFeature(entities?: any[]) {
    return { module: TypeOrmModule, providers: [], exports: [] };
  }
}
