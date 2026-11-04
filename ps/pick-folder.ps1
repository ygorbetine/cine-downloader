# Seletor de pasta moderno do Windows (mesmo estilo do "Importar arquivo" do After Effects):
# barra de endereço, Acesso rápido, painel de navegação e busca. Imprime o caminho escolhido (vazio = cancelado).
param([string]$Initial = '', [string]$Title = 'Escolher pasta de destino')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CinePicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialogRCW {}
  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IShellItem psi, uint hint, out int piOrder);
  }
  [ComImport, Guid("d57c7288-d4ad-4768-be02-9d969532d960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr hwndOwner);
    void SetFileTypes(uint c, IntPtr t);
    void SetFileTypeIndex(uint i);
    void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint c);
    void Unadvise(uint c);
    void SetOptions(uint o);
    void GetOptions(out uint o);
    void SetDefaultFolder(IShellItem s);
    void SetFolder(IShellItem s);
    void GetFolder(out IShellItem s);
    void GetCurrentSelection(out IShellItem s);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void GetResult(out IShellItem s);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, out IShellItem item);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();

  public static string Pick(string initial, string title) {
    IFileOpenDialog dlg = (IFileOpenDialog)new FileOpenDialogRCW();
    uint opts; dlg.GetOptions(out opts);
    dlg.SetOptions(opts | 0x20 | 0x40 | 0x800); // PICKFOLDERS | FORCEFILESYSTEM | PATHMUSTEXIST
    dlg.SetTitle(title);
    if (!string.IsNullOrEmpty(initial) && System.IO.Directory.Exists(initial)) {
      Guid iid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"); IShellItem it;
      SHCreateItemFromParsingName(initial, IntPtr.Zero, ref iid, out it); dlg.SetFolder(it);
    }
    int hr = dlg.Show(GetForegroundWindow());
    if (hr == unchecked((int)0x800704C7)) return ""; // cancelado
    if (hr != 0) Marshal.ThrowExceptionForHR(hr);
    IShellItem res; dlg.GetResult(out res);
    IntPtr p; res.GetDisplayName(0x80058000, out p); // SIGDN_FILESYSPATH
    string s = Marshal.PtrToStringUni(p); Marshal.FreeCoTaskMem(p); return s;
  }
}
"@

[Console]::Out.Write([CinePicker]::Pick($Initial, $Title))
