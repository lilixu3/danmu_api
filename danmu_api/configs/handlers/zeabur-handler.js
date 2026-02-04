import BaseHandler from "./base-handler.js";
import { globals } from "../globals.js";
import { log } from "../../utils/log-util.js";
import { httpPost } from "../../utils/http-util.js";

// =====================
// Zeabur 环境变量 / 重新部署 处理类
//
// 约定（与现有 DEPLOY_PLATFROM_* 保持一致）：
// - DEPLOY_PLATFROM_PROJECT  -> Zeabur Service ID
// - DEPLOY_PLATFROM_ACCOUNT  -> Zeabur Environment ID
// - DEPLOY_PLATFROM_TOKEN    -> Zeabur API Key
//
// 说明：Zeabur 使用 GraphQL API。
// 默认 Endpoint: https://api.zeabur.com/graphql
// =====================

export class ZeaburHandler extends BaseHandler {
  API_URL = "https://api.zeabur.com/graphql";

  _getServiceId() {
    return globals.deployPlatformProject;
  }

  _getEnvironmentId() {
    return globals.deployPlatformAccount;
  }

  _getToken() {
    return globals.deployPlatformToken;
  }

  _headers(token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async _graphql(query, variables = {}, token) {
    const res = await httpPost(
      this.API_URL,
      JSON.stringify({ query, variables }),
      { headers: this._headers(token) }
    );

    const body = res?.data;
    if (body?.errors?.length) {
      const msg = body.errors
        .map((e) => e?.message)
        .filter(Boolean)
        .join("; ");
      throw new Error(msg || "Zeabur GraphQL request failed");
    }
    return body?.data;
  }

  async _listVariables(serviceId, environmentId, token) {
    // Zeabur Schema 可能会演进，因此这里做了几个常见字段名的兼容尝试。
    const candidates = [
      {
        name: "variables",
        query:
          "query ($serviceID: String!, $environmentID: String!) { variables(serviceID: $serviceID, environmentID: $environmentID) { key value } }",
        pick: (d) => d?.variables,
      },
      {
        name: "serviceVariables",
        query:
          "query ($serviceID: String!, $environmentID: String!) { serviceVariables(serviceID: $serviceID, environmentID: $environmentID) { key value } }",
        pick: (d) => d?.serviceVariables,
      },
      {
        name: "environmentVariables",
        query:
          "query ($serviceID: String!, $environmentID: String!) { environmentVariables(serviceID: $serviceID, environmentID: $environmentID) { key value } }",
        pick: (d) => d?.environmentVariables,
      },
    ];

    let lastErr;
    for (const c of candidates) {
      try {
        const data = await this._graphql(
          c.query,
          { serviceID: serviceId, environmentID: environmentId },
          token
        );
        const vars = c.pick(data);
        if (Array.isArray(vars)) return vars;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to list Zeabur variables");
  }

  async _updateVariables(serviceId, environmentId, variablesArr, token) {
    // 兼容尝试：不同 schema 里可能会有不同的 input type / 字段名
    // 这里按“尽量不破坏”的原则：优先尝试 key/value + EnvironmentVariableInput。
    const payloads = [
      {
        name: "updateVariables(EnvironmentVariableInput:key/value)",
        query:
          "mutation ($serviceID: String!, $environmentID: String!, $variables: [EnvironmentVariableInput!]!) { updateVariables(serviceID: $serviceID, environmentID: $environmentID, variables: $variables) }",
        map: (arr) => arr.map((v) => ({ key: v.key, value: v.value })),
      },
      {
        name: "updateVariables(VariableInput:key/value)",
        query:
          "mutation ($serviceID: String!, $environmentID: String!, $variables: [VariableInput!]!) { updateVariables(serviceID: $serviceID, environmentID: $environmentID, variables: $variables) }",
        map: (arr) => arr.map((v) => ({ key: v.key, value: v.value })),
      },
      {
        name: "updateVariables(EnvironmentVariableInput:name/value)",
        query:
          "mutation ($serviceID: String!, $environmentID: String!, $variables: [EnvironmentVariableInput!]!) { updateVariables(serviceID: $serviceID, environmentID: $environmentID, variables: $variables) }",
        map: (arr) => arr.map((v) => ({ name: v.key, value: v.value })),
      },
      {
        name: "setVariables(EnvironmentVariableInput:key/value)",
        query:
          "mutation ($serviceID: String!, $environmentID: String!, $variables: [EnvironmentVariableInput!]!) { setVariables(serviceID: $serviceID, environmentID: $environmentID, variables: $variables) }",
        map: (arr) => arr.map((v) => ({ key: v.key, value: v.value })),
      },
    ];

    let lastErr;
    for (const p of payloads) {
      try {
        await this._graphql(
          p.query,
          {
            serviceID: serviceId,
            environmentID: environmentId,
            variables: p.map(variablesArr),
          },
          token
        );
        return true;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Failed to update Zeabur variables");
  }

  async setEnv(key, value) {
    try {
      const serviceId = this._getServiceId();
      const environmentId = this._getEnvironmentId();
      const token = this._getToken();
      if (!serviceId || !environmentId || !token) {
        throw new Error(
          "Missing Zeabur credentials: DEPLOY_PLATFROM_PROJECT(serviceID), DEPLOY_PLATFROM_ACCOUNT(environmentID), DEPLOY_PLATFROM_TOKEN"
        );
      }

      // 尽量保留现有变量：先拉取，再合并
      let current = [];
      try {
        current = await this._listVariables(serviceId, environmentId, token);
      } catch (e) {
        log(
          "warn",
          `[server] Zeabur listVariables failed, will try upsert only for the target key. reason=${e.message}`
        );
      }

      const map = new Map(
        (current || []).map((v) => [String(v.key), String(v.value ?? "")])
      );
      map.set(String(key), String(value ?? ""));

      const merged = Array.from(map.entries()).map(([k, v]) => ({ key: k, value: v }));
      await this._updateVariables(serviceId, environmentId, merged, token);
      return true;
    } catch (error) {
      log("error", "[server] ✗ Failed to set env in Zeabur:", error.message);
      return false;
    }
  }

  async addEnv(key, value) {
    // Zeabur 的变量逻辑通常是 upsert，因此 add 与 set 行为一致
    return this.setEnv(key, value);
  }

  async delEnv(key) {
    try {
      const serviceId = this._getServiceId();
      const environmentId = this._getEnvironmentId();
      const token = this._getToken();
      if (!serviceId || !environmentId || !token) {
        throw new Error(
          "Missing Zeabur credentials: DEPLOY_PLATFROM_PROJECT(serviceID), DEPLOY_PLATFROM_ACCOUNT(environmentID), DEPLOY_PLATFROM_TOKEN"
        );
      }

      let current = [];
      try {
        current = await this._listVariables(serviceId, environmentId, token);
      } catch (e) {
        // 无法读取列表时，尝试用空值覆盖（部分平台视为空值为删除）
        log(
          "warn",
          `[server] Zeabur listVariables failed, will try set empty value to remove key. reason=${e.message}`
        );
        return await this.setEnv(key, "");
      }

      const filtered = (current || [])
        .filter((v) => String(v.key) !== String(key))
        .map((v) => ({ key: String(v.key), value: String(v.value ?? "") }));

      await this._updateVariables(serviceId, environmentId, filtered, token);
      return true;
    } catch (error) {
      log("error", "[server] ✗ Failed to delete env in Zeabur:", error.message);
      return false;
    }
  }

  async checkParams(accountId, projectId, token) {
    // 兼容 BaseHandler 接口
    const envId = accountId || this._getEnvironmentId();
    const serviceId = projectId || this._getServiceId();
    const apiKey = token || this._getToken();

    if (!envId) throw new Error("Missing DEPLOY_PLATFROM_ACCOUNT (Zeabur Environment ID)");
    if (!serviceId) throw new Error("Missing DEPLOY_PLATFROM_PROJECT (Zeabur Service ID)");
    if (!apiKey) throw new Error("Missing DEPLOY_PLATFROM_TOKEN (Zeabur API Key)");
    return true;
  }

  async deploy() {
    try {
      const serviceId = this._getServiceId();
      const environmentId = this._getEnvironmentId();
      const token = this._getToken();
      await this.checkParams(environmentId, serviceId, token);

      const payloads = [
        {
          name: "restartService",
          query:
            "mutation ($serviceID: String!, $environmentID: String!) { restartService(serviceID: $serviceID, environmentID: $environmentID) }",
        },
        {
          name: "redeployService",
          query:
            "mutation ($serviceID: String!, $environmentID: String!) { redeployService(serviceID: $serviceID, environmentID: $environmentID) }",
        },
        {
          name: "serviceRestart",
          query:
            "mutation ($serviceID: String!, $environmentID: String!) { serviceRestart(serviceID: $serviceID, environmentID: $environmentID) }",
        },
      ];

      let lastErr;
      for (const p of payloads) {
        try {
          await this._graphql(
            p.query,
            { serviceID: serviceId, environmentID: environmentId },
            token
          );
          return true;
        } catch (e) {
          lastErr = e;
        }
      }

      log(
        "error",
        `[server] ✗ Failed to trigger Zeabur deploy: ${lastErr?.message || "unknown"}`
      );
      return false;
    } catch (error) {
      log("error", "[server] ✗ Failed to deploy in Zeabur:", error.message);
      return false;
    }
  }
}
