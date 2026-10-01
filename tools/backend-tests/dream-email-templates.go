// Run from the repository root: go run tools/backend-tests/dream-email-templates.go
// Uses the same standard Go template engines as Supabase Auth, with synthetic data only.
package main

import (
 "bytes"
 "fmt"
 html "html/template"
 "os"
 "strings"
 text "text/template"
)

func main() {
 callback := "https://deploy-preview-2--championlifechurch.netlify.app/discipleship-login.html?next=%2Fdream-track-invite.html"
 cases := []string{callback, strings.Split(callback,"?")[0], "https://evil.example/discipleship-login.html?next=%2Fdream-track-invite.html",callback+"&next=//evil.example"}
 count := 0
 for _, kind := range []string{"magic-link","confirmation"} {
  for _, suffix := range []string{".html",".subject.txt"} {
   path := "supabase/templates/"+kind+suffix
   raw,err := os.ReadFile(path);must(err);source:=string(raw)
   parts:=strings.Split(source,"{{ else }}");if len(parts)!=2 {panic("expected single scoped conditional")};fallback:=strings.TrimSuffix(parts[1],"{{ end }}")
   for _,redirect := range cases {
    data:=map[string]any{"RedirectTo":redirect,"ConfirmationURL":"https://acceptance.example/auth/v1/verify?token=synthetic-only&type=email","Token":"12345678","Data":map[string]string{"dream_track":"true"}}
    var rendered bytes.Buffer
    if suffix==".html" {tmpl,err:=html.New(kind).Parse(source);must(err);must(tmpl.Execute(&rendered,data))} else {tmpl,err:=text.New(kind).Parse(source);must(err);must(tmpl.Execute(&rendered,data))}
    result:=rendered.String()
    if redirect==callback {
     if !strings.Contains(result,"Dream Track")||!strings.Contains(result,"Champion Life") {panic("invitation branding missing")}
     if suffix==".html" {
      for _,expected:=range []string{"seven-lesson","Accept &amp; start Dream Track","12345678","https://acceptance.example/auth/v1/verify?token=synthetic-only&amp;type=email",`<img src="https://championlifefwb.com/assets/images/logo-gold.png" alt="Champion Life Church" width="320"`} {if !strings.Contains(result,expected) {panic("missing secure invitation content or approved logo: "+expected)}}
      if strings.Contains(result,"{{")||strings.Contains(result,"ZgotmplZ") {panic("unrendered or unsafe template")}
      if dir:=os.Getenv("DREAM_EMAIL_PREVIEW_DIR");dir!="" {must(os.WriteFile(dir+"/"+kind+".html",rendered.Bytes(),0600))}
     }
    } else {
     var original bytes.Buffer
     if suffix==".html" {t,e:=html.New("original").Parse(fallback);must(e);must(t.Execute(&original,data))} else {t,e:=text.New("original").Parse(fallback);must(e);must(t.Execute(&original,data))}
     if result!=original.String()||strings.Contains(result,"Dream Track") {panic("unrelated Auth email changed")}
    }
    count++
   }
  }
 }
 fmt.Printf("PASS %d Go email-template render cases: new/existing account, exact invitation callback, ordinary Auth and hostile/nonmatching redirects\n",count)
}
func must(err error) {if err!=nil {panic(err)}}
