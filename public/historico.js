// =========================================================
// 📊 HISTÓRICO PROFISSIONAL HAG
// Versão 5
// Compatível com /historico do server.js
// =========================================================

"use strict";


// =========================================================
// CONFIGURAÇÃO
// =========================================================

const API_HISTORICO =
  window.location.origin + "/historico";

const API_CONSUMO =
  window.location.origin + "/api/consumo_diario?dias=1";

let graficoHistorico = null;


// =========================================================
// NOMES DOS RESERVATÓRIOS
// =========================================================

const NOMES_RESERVATORIOS = {

  elevador:
    "Elevador",

  lavanderia:
    "Lavanderia",

  osmose:
    "Osmose",

  cme:
    "CME",

  abrandada:
    "Água Abrandada"
};


// =========================================================
// FORMATAR NOME
// =========================================================

function formatarNomeReservatorio(
  nome
) {

  return (
    NOMES_RESERVATORIOS[nome] ||
    String(nome || "")
      .replace(/_/g, " ")
      .replace(
        /reservatorio/gi,
        "Reservatório"
      )
      .replace(
        /agua/gi,
        "Água"
      )
      .trim()
  );
}


// =========================================================
// FORMATAR NÚMERO
// =========================================================

function formatarNumero(
  valor
) {

  return Number(
    valor || 0
  ).toLocaleString(
    "pt-BR"
  );
}


// =========================================================
// FORMATAR DATA
// =========================================================

function formatarData(
  timestamp
) {

  const data =
    new Date(timestamp);

  if (
    isNaN(
      data.getTime()
    )
  ) {
    return "-";
  }

  return data.toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone:
        "America/Sao_Paulo"
    }
  );
}


// =========================================================
// ATUALIZAR TEXTO
// =========================================================

function setText(
  id,
  valor
) {

  const elemento =
    document.getElementById(
      id
    );

  if (!elemento) {
    return;
  }

  elemento.textContent =
    formatarNumero(
      valor
    ) + " L";
}


// =========================================================
// CLASSIFICAÇÃO DO NÍVEL
// =========================================================

function classeNivel(
  percentual
) {

  const p =
    Number(
      percentual || 0
    );

  if (p <= 20) {
    return "nivel-critico";
  }

  if (p <= 40) {
    return "nivel-alerta";
  }

  if (p <= 70) {
    return "nivel-atencao";
  }

  return "nivel-normal";
}


// =========================================================
// NORMALIZAR HISTÓRICO
//
// O servidor retorna:
//
// {
//   elevador: [
//      { x, y, litros, corrente }
//   ],
//   osmose: [...]
// }
//
// Transformamos em um array único para a tabela.
// =========================================================

function normalizarHistorico(
  dados
) {

  const registros = [];

  if (
    !dados ||
    typeof dados !==
      "object"
  ) {
    return registros;
  }


  Object.entries(
    dados
  ).forEach(
    ([reservatorio, pontos]) => {

      if (
        !Array.isArray(
          pontos
        )
      ) {
        return;
      }


      pontos.forEach(
        (ponto) => {

          const timestamp =
            Number(
              ponto.x
            );

          const percentual =
            Number(
              ponto.y || 0
            );

          const litros =
            Number(
              ponto.litros || 0
            );

          if (
            !timestamp ||
            isNaN(timestamp)
          ) {
            return;
          }


          registros.push({

            reservatorio,

            timestamp,

            percentual,

            litros,

            corrente:
              Number(
                ponto.corrente ||
                0
              )

          });

        }
      );

    }
  );


  // =======================================================
  // REMOVER DUPLICADOS
  //
  // Mesmo reservatório + mesmo timestamp + mesmo volume
  // =======================================================

  const mapa =
    new Map();


  registros.forEach(
    (registro) => {

      const chave =
        [
          registro.reservatorio,
          registro.timestamp,
          registro.litros,
          registro.percentual
        ].join("|");

      mapa.set(
        chave,
        registro
      );

    }
  );


  return Array.from(
    mapa.values()
  );

}


// =========================================================
// CRIAR TABELA
// =========================================================

function criarTabela(
  registros
) {

  const container =
    document.getElementById(
      "historico"
    );


  if (!container) {
    return;
  }


  if (
    !registros.length
  ) {

    container.innerHTML = `
      <div class="sem-dados">
        📭 Nenhum registro histórico encontrado.
      </div>
    `;

    return;
  }


  // Mais recentes primeiro

  registros.sort(
    (a, b) =>
      b.timestamp -
      a.timestamp
  );


  let html = `

    <div class="tabela-wrapper">

      <table class="tabela-historico">

        <thead>

          <tr>

            <th>
              Data
            </th>

            <th>
              Reservatório
            </th>

            <th>
              Nível (%)
            </th>

            <th>
              Volume (L)
            </th>

          </tr>

        </thead>

        <tbody>

  `;


  registros.forEach(
    (registro) => {

      const percentual =
        Math.max(
          0,
          Math.min(
            100,
            registro.percentual
          )
        );


      html += `

        <tr>

          <td>
            ${formatarData(
              registro.timestamp
            )}
          </td>

          <td>

            <span class="reservatorio-badge">

              ${formatarNomeReservatorio(
                registro.reservatorio
              )}

            </span>

          </td>

          <td>

            <span
              class="nivel-badge ${classeNivel(
                percentual
              )}"
            >

              ${percentual.toFixed(1)}%

            </span>

          </td>

          <td>

            <strong>
              ${formatarNumero(
                registro.litros
              )} L
            </strong>

          </td>

        </tr>

      `;

    }
  );


  html += `

        </tbody>

      </table>

    </div>

  `;


  container.innerHTML =
    html;

}


// =========================================================
// CRIAR GRÁFICO
// =========================================================

function criarGrafico(
  dados
) {

  const canvas =
    document.getElementById(
      "graficoHistorico"
    );


  if (!canvas) {
    return;
  }


  if (
    typeof Chart ===
    "undefined"
  ) {

    console.error(
      "Chart.js não carregado."
    );

    return;
  }


  // Destruir gráfico anterior

  if (
    graficoHistorico
  ) {

    graficoHistorico.destroy();

    graficoHistorico =
      null;
  }


  const cores = [

    "#00e5ff",
    "#00ff88",
    "#ffd600",
    "#ff9800",
    "#b388ff"

  ];


  const datasets = [];


  Object.entries(
    dados || {}
  ).forEach(
    (
      [
        reservatorio,
        pontos
      ],
      index
    ) => {

      if (
        !Array.isArray(
          pontos
        ) ||
        !pontos.length
      ) {
        return;
      }


      // ===================================================
      // REMOVER DUPLICADOS DO GRÁFICO
      // ===================================================

      const mapa =
        new Map();


      pontos.forEach(
        (ponto) => {

          const x =
            Number(
              ponto.x
            );

          const y =
            Number(
              ponto.y || 0
            );

          if (
            !x ||
            isNaN(x)
          ) {
            return;
          }


          const chave =
            `${x}_${y}`;

          mapa.set(
            chave,
            {
              x,
              y
            }
          );

        }
      );


      const valores =
        Array.from(
          mapa.values()
        ).sort(
          (a, b) =>
            a.x - b.x
        );


      if (
        !valores.length
      ) {
        return;
      }


      datasets.push({

        label:
          formatarNomeReservatorio(
            reservatorio
          ),

        data:
          valores,

        borderColor:
          cores[
            index %
            cores.length
          ],

        backgroundColor:
          cores[
            index %
            cores.length
          ],

        borderWidth: 2,

        pointRadius: 1,

        pointHoverRadius: 4,

        tension: 0.25,

        fill: false

      });

    }
  );


  if (
    !datasets.length
  ) {
    return;
  }


  graficoHistorico =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          datasets

        },

        options: {

          responsive: true,

          maintainAspectRatio:
            false,

          parsing: false,

          interaction: {

            mode:
              "nearest",

            intersect:
              false

          },

          plugins: {

            legend: {

              position:
                "bottom",

              labels: {

                color:
                  "#e6f1ee",

                usePointStyle:
                  true,

                padding: 15

              }

            },

            tooltip: {

              callbacks: {

                title:
                  function(
                    items
                  ) {

                    if (
                      !items.length
                    ) {
                      return "";
                    }

                    return new Date(
                      items[0]
                        .parsed
                        .x
                    ).toLocaleString(
                      "pt-BR"
                    );

                  },

                label:
                  function(
                    context
                  ) {

                    return (
                      " " +
                      context
                        .dataset
                        .label +
                      ": " +
                      Number(
                        context.parsed.y
                      ).toFixed(
                        1
                      ) +
                      "%"
                    );

                  }

              }

            },

            title: {

              display:
                false

            }

          },

          scales: {

            x: {

              type:
                "time",

              time: {

                tooltipFormat:
                  "dd/MM/yyyy HH:mm:ss",

                displayFormats: {

                  hour:
                    "dd/MM HH:mm",

                  day:
                    "dd/MM"

                }

              },

              ticks: {

                color:
                  "#b9ccc7",

                maxRotation:
                  0

              },

              grid: {

                color:
                  "rgba(255,255,255,.06)"

              }

            },

            y: {

              beginAtZero:
                true,

              min:
                0,

              max:
                100,

              ticks: {

                color:
                  "#b9ccc7",

                callback:
                  function(
                    value
                  ) {

                    return (
                      value +
                      "%"
                    );

                  }

              },

              grid: {

                color:
                  "rgba(255,255,255,.06)"

              }

            }

          }

        }

      }
    );

}


// =========================================================
// CARREGAR CONSUMO
//
// Agora usamos o endpoint oficial:
// /api/consumo_diario
// =========================================================

async function carregarConsumo() {

  try {

    const resposta =
      await fetch(
        API_CONSUMO +
        "&_=" +
        Date.now(),
        {
          cache:
            "no-store",

          headers: {
            "Cache-Control":
              "no-cache"
          }
        }
      );


    if (
      !resposta.ok
    ) {

      throw new Error(
        "Erro ao carregar consumo"
      );

    }


    const dados =
      await resposta.json();


    const elevador =
      Number(
        dados.elevador?.[0] ||
        0
      );

    const lavanderia =
      Number(
        dados.lavanderia?.[0] ||
        0
      );

    const osmose =
      Number(
        dados.osmose?.[0] ||
        0
      );


    const total =
      elevador +
      lavanderia +
      osmose;


    setText(
      "consumoElevador",
      elevador
    );

    setText(
      "consumoLavanderia",
      lavanderia
    );

    setText(
      "consumoOsmose",
      osmose
    );

    setText(
      "consumoTotal",
      total
    );


  } catch (erro) {

    console.error(
      "Erro consumo:",
      erro
    );

  }

}


// =========================================================
// CARREGAR HISTÓRICO
// =========================================================

async function carregarHistorico() {

  const container =
    document.getElementById(
      "historico"
    );

  const botao =
    document.getElementById(
      "btnAtualizar"
    );


  if (container) {

    container.innerHTML = `

      <div class="carregando">

        ⏳ Carregando histórico...

      </div>

    `;

  }


  if (botao) {

    botao.disabled =
      true;

    botao.textContent =
      "⏳ Atualizando...";

  }


  try {

    // =====================================================
    // HISTÓRICO
    // =====================================================

    const resposta =
      await fetch(
        API_HISTORICO +
        "?_=" +
        Date.now(),
        {
          cache:
            "no-store",

          headers: {
            "Cache-Control":
              "no-cache"
          }
        }
      );


    if (
      !resposta.ok
    ) {

      throw new Error(
        "Erro HTTP " +
        resposta.status +
        " ao buscar histórico"
      );

    }


    const dados =
      await resposta.json();


    console.log(
      "📊 Histórico recebido:",
      dados
    );


    // =====================================================
    // NORMALIZAR
    // =====================================================

    const registros =
      normalizarHistorico(
        dados
      );


    console.log(
      "📋 Registros normalizados:",
      registros.length
    );


    // =====================================================
    // TABELA
    // =====================================================

    criarTabela(
      registros
    );


    // =====================================================
    // GRÁFICO
    // =====================================================

    criarGrafico(
      dados
    );


    // =====================================================
    // CONSUMO
    // =====================================================

    await carregarConsumo();


    // =====================================================
    // HORA
    // =====================================================

    const hora =
      document.getElementById(
        "horaHistorico"
      );


    if (hora) {

      hora.textContent =
        "Atualizado: " +
        new Date()
          .toLocaleTimeString(
            "pt-BR"
          );

    }


  } catch (erro) {

    console.error(
      "❌ Erro histórico:",
      erro
    );


    if (container) {

      container.innerHTML = `

        <div class="erro-historico">

          ❌ Não foi possível carregar o histórico.

          <br>

          <small>
            ${erro.message}
          </small>

        </div>

      `;

    }

  } finally {

    if (botao) {

      botao.disabled =
        false;

      botao.textContent =
        "🔄 Atualizar";

    }

  }

}


// =========================================================
// BOTÃO
// =========================================================

document.addEventListener(
  "DOMContentLoaded",
  function() {

    const botao =
      document.getElementById(
        "btnAtualizar"
      );


    if (botao) {

      botao.addEventListener(
        "click",
        carregarHistorico
      );

    }


    carregarHistorico();

  }
);


// =========================================================
// ATUALIZAÇÃO AUTOMÁTICA
// =========================================================

setInterval(
  carregarHistorico,
  60 * 1000
);
