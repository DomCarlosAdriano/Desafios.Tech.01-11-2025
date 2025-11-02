import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { QueryParamsDto } from './dto/query-params.dto';

// --- Mock do EntityManager ---
// Nós simulamos o que o EntityManager deve fazer.
// O mais importante é o 'mockQuery', que podemos espionar (spyOn).
const mockEntityManager = {
  query: jest.fn(),
};

// --- Mock dos Resultados ---
// O que esperamos que o banco de dados (falso) retorne
const mockKpiResultRaw = [
  {
    totalRevenue: '125000',
    avgTicket: '85.50',
    totalSales: '1472',
    cancelRate: '0.025',
  },
];

describe('ReportsService', () => {
  let service: ReportsService;
  let entityManager: EntityManager;

  // Antes de cada teste, cria um novo módulo de teste
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getEntityManagerToken(),
          useValue: mockEntityManager, // Usa nosso EntityManager falso
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    entityManager = module.get<EntityManager>(EntityManager);

    // Limpa o mock antes de cada teste
    jest.clearAllMocks();
  });

  // --- Teste 1: Conexão ---
  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  // --- Teste 2: getKpis (Sem Filtros) ---
  it('deve chamar getKpis e retornar os KPIs formatados corretamente', async () => {
    // Configura o mock: Quando 'query' for chamado, retorne nosso resultado falso
    mockEntityManager.query = jest.fn().mockResolvedValue(mockKpiResultRaw);

    const queryParams: QueryParamsDto = {}; // Sem filtros
    const result = await service.getKpis(queryParams);

    // 1. Verifica se a função 'query' foi chamada
    expect(entityManager.query).toHaveBeenCalledTimes(1);

    // 2. Verifica se o resultado foi formatado (de string para número)
    expect(result.totalRevenue).toBe(125000);
    expect(result.avgTicket).toBe(85.5);
    expect(result.totalSales).toBe(1472);
    expect(result.cancelRate).toBe(0.025);
  });

  // --- Teste 3: getKpis (COM Filtros V2) ---
  it('deve construir a query SQL correta ao receber filtros V2', async () => {
    // Configura o mock
    mockEntityManager.query = jest.fn().mockResolvedValue(mockKpiResultRaw);

    // Define os filtros da V2
    const queryParams: QueryParamsDto = {
      channelIds: [1, 3],
      storeIds: [5],
      dayOfWeek: [0, 6], // Fins de semana
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    // Espiona a chamada da query para ver *com quais argumentos* ela foi chamada
    const querySpy = jest.spyOn(entityManager, 'query');

    await service.getKpis(queryParams);

    // 1. Pega a query SQL que foi executada (primeiro argumento da chamada)
    const executedQuery: string = querySpy.mock.calls[0][0];

    // 2. Pega os parâmetros que foram passados (segundo argumento da chamada)
    // CORREÇÃO: Adicionado '|| []' para garantir que 'executedParams' seja sempre um array
    const executedParams: any[] = querySpy.mock.calls[0][1] || [];

    // 3. Verifica se a query SQL contém as cláusulas V2 (o mais importante!)
    expect(executedQuery).toContain('s.created_at >= $1');
    expect(executedQuery).toContain('s.created_at <= $2');
    expect(executedQuery).toContain('s.channel_id = ANY($3)');
    expect(executedQuery).toContain('s.store_id = ANY($4)');
    expect(executedQuery).toContain('EXTRACT(DOW FROM s.created_at) = ANY($5)');

    // 4. Verifica se os parâmetros estão corretos e na ordem certa
    expect(executedParams).toEqual([
      '2024-01-01 00:00:00',
      '2024-01-31 23:59:59',
      [1, 3],
      [5],
      [0, 6],
    ]);
  });

  // (Aqui poderíamos adicionar testes para getRevenueOverTime, getTopProducts, etc.)
});

