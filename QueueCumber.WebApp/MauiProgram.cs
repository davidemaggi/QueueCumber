using Microsoft.Extensions.Logging;
using MudBlazor.Services;
using MudBlazor.Services;
using QueueCumber.Tools;
using QueueCumber.Data;
using QueueCumber.Data.Repositories;
using QueueCumber.Core;

namespace QueueCumber.WebApp
{
    public static class MauiProgram
    {
        public static MauiApp CreateMauiApp()
        {
            var builder = MauiApp.CreateBuilder();
            builder
                .UseMauiApp<App>()
                .ConfigureFonts(fonts =>
                {
                    fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                });

            builder.Services.AddMauiBlazorWebView();

#if DEBUG
    		builder.Services.AddBlazorWebViewDeveloperTools();
    		builder.Logging.AddDebug();
#endif

            builder.Services.AddSingleton<SecurityService>();
            builder.Services.AddSingleton<FsService>();
            builder.Services.AddSingleton<IQueueCumberDataService, QueueCumberDataService>();
            builder.Services.AddSingleton<IQueueCumberService, QueueCumberService>();

            
            builder.Services.AddSingleton<IConnectionRepository, ConnectionRepository>();

            builder.Services.AddMudServices();


            return builder.Build();
        }
    }
}
