using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;
using System.Globalization;
using System.Windows.Forms;

// No browser APIs, window titles, command lines, memory dumps, URLs or network connections.
class MonitorEdge : Form {
    readonly Stopwatch clock = Stopwatch.StartNew();
    readonly Dictionary<int, double> lastCpu = new Dictionary<int, double>();
    readonly Dictionary<int, int> aliases = new Dictionary<int, int>();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly string folder;
    readonly StreamWriter log;
    readonly Label status = new Label();
    bool finished;
    double lastAt;
    int ticks;
    string session;
    static string N(double n) { return Math.Round(n,1).ToString(CultureInfo.InvariantCulture); }
    public MonitorEdge(bool selfTest) {
        folder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resultados");
        Directory.CreateDirectory(folder);
        session = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        log = new StreamWriter(Path.Combine(folder, "edge-"+session+".jsonl"), false);
        log.AutoFlush = true;
        log.WriteLine("{\"diagnostic\":\"edge-external-sampler-v1\",\"intervalMs\":1000,\"durationSeconds\":180,\"cpuScale\":\"100 percent = one logical core\",\"privacy\":\"numeric process aggregates only; no titles, URLs, command lines, cookies, tokens or memory contents\",\"limitation\":\"all Edge processes, no mapping to app/tab; does not identify JS functions; Responding is not renderer responsiveness\"}");
        Text = "DealSifter - Monitor externo (3 minutos)";
        Width = 660; Height = 280; StartPosition = FormStartPosition.CenterScreen;
        status.SetBounds(18,18,600,120);
        status.Text = "Monitor externo iniciado. Nao depende da pagina do Edge.\n\nNo DealSifter, acione o icone da extensao e gere UM L3.\nSe aparecer 'nao esta respondendo', escolha Aguardar.\nA captura termina em 3 minutos; nao feche esta janela antes disso.";
        Controls.Add(status);
        var done = new Button { Text = "Concluir agora", Left = 18, Top = 158, Width = 150 };
        done.Click += delegate { Finish(); }; Controls.Add(done);
        var files = new Button { Text = "Abrir resultados", Left = 180, Top = 158, Width = 150 };
        files.Click += delegate { Process.Start("explorer.exe", folder); }; Controls.Add(files);
        timer.Interval = 1000;
        timer.Tick += delegate { Sample(); if (clock.Elapsed.TotalSeconds >= (selfTest ? 3 : 180)) { Finish(); if (selfTest) Close(); } };
        FormClosing += delegate { Finish(); };
        timer.Start(); Sample();
    }
    void Sample() {
        double at = clock.Elapsed.TotalMilliseconds;
        var rows = new List<string>();
        foreach (var process in Process.GetProcessesByName("msedge")) using (process) {
            try {
                int id = process.Id;
                if (!aliases.ContainsKey(id)) aliases[id] = aliases.Count+1;
                double cpu = process.TotalProcessorTime.TotalMilliseconds, old;
                double percent = lastCpu.TryGetValue(id,out old) && at > lastAt ? Math.Max(0,(cpu-old)/(at-lastAt)*100) : 0;
                lastCpu[id] = cpu;
                rows.Add("{\"process\":"+aliases[id]+",\"cpuOneCorePercent\":"+N(percent)+",\"workingSetMB\":"+N(process.WorkingSet64/1048576.0)+",\"privateMB\":"+N(process.PrivateMemorySize64/1048576.0)+",\"threads\":"+process.Threads.Count+"}");
            } catch { /* Process can exit during sampling. Never persist raw OS error messages. */ }
        }
        log.WriteLine("{\"atMs\":"+N(at)+",\"samplingGapMs\":"+N(at-lastAt)+",\"edgeProcesses\":["+String.Join(",",rows.ToArray())+"]}");
        lastAt = at; ticks++;
    }
    void Finish() {
        if (finished) return;
        finished = true; timer.Stop();
        log.WriteLine("{\"completed\":true,\"elapsedMs\":"+N(clock.Elapsed.TotalMilliseconds)+",\"samples\":"+ticks+"}");
        log.Dispose();
        status.Text = "Captura externa concluida. Arquivo salvo automaticamente em:\n\n"+folder+"\n\nO JSON da extensao fica na pasta de downloads do Edge, em DealSifter-Diagnostico.";
    }
    [STAThread] static void Main(string[] args) {
        Application.EnableVisualStyles();
        Application.Run(new MonitorEdge(Array.IndexOf(args,"--self-test") >= 0));
    }
}
