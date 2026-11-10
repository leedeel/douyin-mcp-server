import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { resolveDataDir } from '../douyin-uploader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

describe('resolveDataDir', () => {
  let tmpBase: string;
  const originalEnv = process.env.DOUYIN_DATA_DIR;

  beforeEach(async () => {
    tmpBase = await mkdtemp(path.join(tmpdir(), 'douyin-datadir-'));
  });

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.DOUYIN_DATA_DIR;
    } else {
      process.env.DOUYIN_DATA_DIR = originalEnv;
    }
  });

  describe('环境变量覆盖', () => {
    it('应优先使用 DOUYIN_DATA_DIR', () => {
      process.env.DOUYIN_DATA_DIR = tmpBase;
      expect(resolveDataDir(repoRoot)).toBe(path.resolve(tmpBase));
    });

    it('应把相对路径解析为绝对路径', () => {
      process.env.DOUYIN_DATA_DIR = 'some/relative/dir';
      expect(resolveDataDir(repoRoot)).toBe(path.resolve('some/relative/dir'));
    });
  });

  describe('仓库根目录探测', () => {
    it('应从 mcp-server/ 定位到仓库根', () => {
      delete process.env.DOUYIN_DATA_DIR;
      expect(resolveDataDir(path.join(repoRoot, 'mcp-server'))).toBe(repoRoot);
    });

    it('应从编译产物 dist/mcp-server/ 定位到仓库根', () => {
      delete process.env.DOUYIN_DATA_DIR;
      expect(resolveDataDir(path.join(repoRoot, 'mcp-server/dist/mcp-server'))).toBe(repoRoot);
    });

    it('不应把 dist/ 误判成仓库根', () => {
      // mcp-server/dist/ 下也有一个叫 mcp-server 的目录（编译产物），
      // 只看子目录名会误判，导致数据又落回 dist/
      delete process.env.DOUYIN_DATA_DIR;
      expect(resolveDataDir(path.join(repoRoot, 'mcp-server/dist/mcp-server'))).not.toBe(
        path.join(repoRoot, 'mcp-server/dist')
      );
    });

    it('应从仓库内的 skill 目录定位到仓库根', () => {
      delete process.env.DOUYIN_DATA_DIR;
      expect(resolveDataDir(path.join(repoRoot, 'skills/douyin'))).toBe(repoRoot);
    });
  });

  describe('回退行为', () => {
    it('找不到仓库标记时回退到起始目录本身', async () => {
      delete process.env.DOUYIN_DATA_DIR;
      const standalone = path.join(tmpBase, 'standalone-skill');
      await mkdir(standalone, { recursive: true });

      expect(resolveDataDir(standalone)).toBe(standalone);
    });

    it('只有 package.json 而没有 mcp-server/ 子目录时不应视为仓库根', async () => {
      delete process.env.DOUYIN_DATA_DIR;
      const fake = path.join(tmpBase, 'fake-repo');
      await mkdir(fake, { recursive: true });
      await writeFile(path.join(fake, 'package.json'), JSON.stringify({ name: 'douyin-mcp-server' }));

      expect(resolveDataDir(fake)).toBe(fake);
    });

    it('只有 mcp-server/ 子目录而没有 package.json 时不应视为仓库根', async () => {
      delete process.env.DOUYIN_DATA_DIR;
      const fake = path.join(tmpBase, 'fake-repo2');
      await mkdir(path.join(fake, 'mcp-server'), { recursive: true });

      expect(resolveDataDir(fake)).toBe(fake);
    });
  });
});
